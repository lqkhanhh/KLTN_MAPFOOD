import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class ApiClient {
  ApiClient(this.baseUrl);
  final String baseUrl;
  final _storage = const FlutterSecureStorage();
  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body, {bool authorized = true}) async {
    final headers = {'Content-Type': 'application/json'};
    if (authorized) { final token = await _storage.read(key: 'accessToken'); if (token != null) headers['Authorization'] = 'Bearer $token'; }
    final response = await http.post(Uri.parse('$baseUrl/api$path'), headers: headers, body: jsonEncode(body));
    final data = response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400) throw Exception(data['message'] ?? 'Request failed');
    return data;
  }
  Future<void> saveSession(Map<String, dynamic> value) async { await _storage.write(key: 'accessToken', value: value['accessToken'] as String); await _storage.write(key: 'refreshToken', value: value['refreshToken'] as String); }
  Future<void> logout() => _storage.deleteAll();
}
