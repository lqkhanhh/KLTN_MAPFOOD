import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:routebite/main.dart';

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  testWidgets('Material 3 login fits compact and expanded screens',
      (tester) async {
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    for (final width in [320.0, 375.0, 1440.0]) {
      tester.view.physicalSize = Size(width, 900);
      await tester.pumpWidget(const RouteBiteApp());
      await tester.pumpAndSettle();
      expect(Theme.of(tester.element(find.byType(LoginPage))).useMaterial3,
          isTrue);
      expect(find.byType(TextFormField), findsNWidgets(2));
      expect(tester.takeException(), isNull);
    }
    await tester.ensureVisible(find.byType(FilledButton));
    await tester.tap(find.byType(FilledButton));
    await tester.pumpAndSettle();
    expect(find.text('Nhập email hợp lệ'), findsOneWidget);
    expect(find.text('Nhập mật khẩu'), findsOneWidget);
    await tester.tap(find.byTooltip('Hiện mật khẩu'));
    await tester.pumpAndSettle();
    expect(find.byTooltip('Ẩn mật khẩu'), findsOneWidget);
  });

  testWidgets(
      'Compact route search rejects invalid coordinates without a request',
      (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 900);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(MaterialApp(
        theme: ThemeData(useMaterial3: true), home: const RouteSearchPage()));
    await tester.enterText(find.byType(TextField).first, '999');
    await tester.ensureVisible(find.text('Tìm quán'));
    await tester.tap(find.text('Tìm quán'));
    await tester.pumpAndSettle();
    expect(find.text('Vui lòng nhập tọa độ hợp lệ.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
      'Restaurant details show a disabled action for unfinished checkout',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
        theme: ThemeData(useMaterial3: true),
        home: const RestaurantPage(
          restaurant: {
            'name': 'Quán kiểm thử',
            'address': 'TP. Hồ Chí Minh',
            'rating': 4.8
          },
        )));
    expect(find.text('Quán kiểm thử'), findsOneWidget);
    expect(tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNull);
    expect(tester.takeException(), isNull);
  });
}
