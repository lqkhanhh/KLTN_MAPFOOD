import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:routebite/api_client.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('Reopening uses saved session without login or OTP', () async {
    FlutterSecureStorage.setMockInitialValues(
        {'accessToken': 'saved', 'refreshToken': 'refresh'});
    final calls = <String>[];
    final api = ApiClient('https://test.invalid', client: MockClient((r) async {
      calls.add(r.url.path);
      expect(r.headers['Authorization'], 'Bearer saved');
      return http.Response('{"id":"user"}', 200);
    }));
    expect(await api.restoreSession(), isTrue);
    expect(calls, ['/api/auth/profile']);
    await api.logout();
    expect(await api.restoreSession(), isFalse);
  });
  test('Expired access silently refreshes; rejected refresh requires login',
      () async {
    FlutterSecureStorage.setMockInitialValues(
        {'accessToken': 'expired', 'refreshToken': 'refresh'});
    var reject = false, refreshes = 0;
    final api = ApiClient('https://test.invalid', client: MockClient((r) async {
      if (r.url.path.endsWith('/refresh')) {
        refreshes++;
        return reject
            ? http.Response('{}', 401)
            : http.Response(
                jsonEncode(
                    {'accessToken': 'new', 'refreshToken': 'new-refresh'}),
                201);
      }
      return r.headers['Authorization'] == 'Bearer new'
          ? http.Response('{}', 200)
          : http.Response('{}', 401);
    }));
    expect(await api.restoreSession(), isTrue);
    expect(refreshes, 1);
    await api
        .saveSession({'accessToken': 'expired', 'refreshToken': 'refresh'});
    reject = true;
    expect(await api.restoreSession(), isFalse);
    expect(
        await const FlutterSecureStorage().read(key: 'refreshToken'), isNull);
  });
  test('Network failure keeps saved session', () async {
    FlutterSecureStorage.setMockInitialValues(
        {'accessToken': 'saved', 'refreshToken': 'refresh'});
    final api = ApiClient('https://test.invalid',
        client: MockClient((r) async => throw http.ClientException('offline')));
    await expectLater(
        api.restoreSession(), throwsA(isA<http.ClientException>()));
    expect(await const FlutterSecureStorage().read(key: 'refreshToken'),
        'refresh');
  });
}
