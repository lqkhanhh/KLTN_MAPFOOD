import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class SessionExpired implements Exception {
  @override
  String toString() =>
      'Phiên đã hết hạn. Vui lòng đăng nhập và xác minh OTP lại.';
}

class ApiClient {
  ApiClient(this.baseUrl, {http.Client? client})
      : _client = client ?? http.Client();
  final String baseUrl;
  final http.Client _client;
  final _storage = const FlutterSecureStorage();
  Future<void>? _refreshing;
  int _generation = 0;
  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body,
          {bool authorized = true}) =>
      _request(path, body: body, authorized: authorized);

  Future<Map<String, dynamic>> _request(String path,
      {Map<String, dynamic>? body,
      bool authorized = true,
      bool retried = false}) async {
    final headers = {'Content-Type': 'application/json'};
    if (authorized) {
      final token = await _storage.read(key: 'accessToken');
      if (token != null) headers['Authorization'] = 'Bearer $token';
    }
    final url = Uri.parse('$baseUrl/api$path');
    final response = await (body == null
            ? _client.get(url, headers: headers)
            : _client.post(url, headers: headers, body: jsonEncode(body)))
        .timeout(const Duration(seconds: 20));
    final data = response.body.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode == 401 && authorized && !retried) {
      _refreshing ??= _refresh().whenComplete(() => _refreshing = null);
      await _refreshing;
      return _request(path, body: body, authorized: true, retried: true);
    }
    if (response.statusCode == 401 && (authorized || path == '/auth/refresh')) {
      await logout();
      throw SessionExpired();
    }
    if (response.statusCode >= 400)
      throw Exception(data['message'] ?? 'Request failed');
    return data;
  }

  Future<void> _refresh() async {
    final generation = _generation;
    final token = await _storage.read(key: 'refreshToken');
    if (token == null) {
      await logout();
      throw SessionExpired();
    }
    final session =
        await post('/auth/refresh', {'refreshToken': token}, authorized: false);
    if (generation != _generation) throw SessionExpired();
    await saveSession(session);
  }

  Future<bool> restoreSession() async {
    if (await _storage.read(key: 'accessToken') == null &&
        await _storage.read(key: 'refreshToken') == null) return false;
    try {
      await _request('/auth/profile');
      return true;
    } on SessionExpired {
      return false;
    }
  }

  Future<void> saveSession(Map<String, dynamic> value) async {
    await _storage.write(
        key: 'accessToken', value: value['accessToken'] as String);
    await _storage.write(
        key: 'refreshToken', value: value['refreshToken'] as String);
  }

  Future<void> logout() async {
    _generation++;
    await _storage.deleteAll();
  }
}
