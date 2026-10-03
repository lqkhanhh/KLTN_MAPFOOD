import 'package:flutter/material.dart';
import 'dart:async';
import 'api_client.dart';

final api = ApiClient(const String.fromEnvironment('API_URL',
    defaultValue: 'http://localhost:3000'));
void main() => runApp(const RouteBiteApp());

class RouteBiteApp extends StatelessWidget {
  const RouteBiteApp({super.key});
  @override
  Widget build(BuildContext context) {
    final colors = ColorScheme.fromSeed(seedColor: const Color(0xFF9B432B));
    return MaterialApp(
        title: 'RouteBite',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
            useMaterial3: true,
            fontFamily: 'Be Vietnam Pro',
            textTheme: const TextTheme(
              headlineLarge:
                  TextStyle(fontFamily: 'Lora', fontWeight: FontWeight.w600),
              headlineMedium:
                  TextStyle(fontFamily: 'Lora', fontWeight: FontWeight.w600),
              headlineSmall:
                  TextStyle(fontFamily: 'Lora', fontWeight: FontWeight.w600),
            ),
            colorScheme: colors,
            scaffoldBackgroundColor: colors.surface,
            appBarTheme: AppBarTheme(
                backgroundColor: colors.surface, centerTitle: false),
            inputDecorationTheme: const InputDecorationTheme(
                border: OutlineInputBorder(),
                contentPadding: EdgeInsets.all(16)),
            filledButtonTheme: FilledButtonThemeData(
                style:
                    FilledButton.styleFrom(minimumSize: const Size(48, 48)))),
        home: const SessionGate());
  }
}

class SessionGate extends StatefulWidget {
  const SessionGate({super.key});
  @override
  State<SessionGate> createState() => _SessionGateState();
}

class _SessionGateState extends State<SessionGate> {
  late Future<bool> restored = api.restoreSession();
  @override
  Widget build(BuildContext context) => FutureBuilder<bool>(
      future: restored,
      builder: (context, snapshot) {
        if (snapshot.hasError)
          return Scaffold(
              body: Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text(
                'Chưa kết nối được máy chủ. Phiên đăng nhập vẫn được giữ.'),
            FilledButton(
                onPressed: () =>
                    setState(() => restored = api.restoreSession()),
                child: const Text('Thử lại')),
          ])));
        if (!snapshot.hasData)
          return const Scaffold(
              body: Center(child: CircularProgressIndicator()));
        return snapshot.data! ? const RouteSearchPage() : const LoginPage();
      });
}

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});
  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final email = TextEditingController(), password = TextEditingController();
  final formKey = GlobalKey<FormState>();
  bool loading = false, obscure = true;
  final otp = TextEditingController();
  Map<String, dynamic>? challenge;
  DateTime? retryAt, expiresAt;
  Timer? timer;
  void acceptChallenge(Map<String, dynamic> result) {
    setState(() {
      challenge = result;
      password.clear();
      otp.clear();
      retryAt =
          DateTime.now().add(Duration(seconds: result['retryAfter'] as int));
      expiresAt =
          DateTime.now().add(Duration(seconds: result['expiresIn'] as int));
    });
    timer?.cancel();
    timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    email.dispose();
    password.dispose();
    otp.dispose();
    timer?.cancel();
    super.dispose();
  }

  Future<void> login() async {
    if (loading || !formKey.currentState!.validate()) return;
    setState(() => loading = true);
    try {
      final result = await api.post('/auth/login',
          {'email': email.text.trim(), 'password': password.text},
          authorized: false);
      if (mounted) acceptChallenge(result);
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$error')));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> verifyOtp({bool resend = false}) async {
    if (loading || challenge == null) return;
    setState(() => loading = true);
    try {
      final result = await api.post(
          resend ? '/auth/email-otp/resend' : '/auth/email-otp/verify',
          {
            'loginTicket': challenge!['loginTicket'],
            if (!resend) 'code': otp.text.trim()
          },
          authorized: false);
      if (!mounted) return;
      if (resend) {
        acceptChallenge(result);
        return;
      }
      await api.saveSession(result);
      if (mounted)
        Navigator.pushReplacement(context,
            MaterialPageRoute<void>(builder: (_) => const RouteSearchPage()));
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$error')));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (challenge != null) {
      final remaining = retryAt!.difference(DateTime.now()).inSeconds;
      final expired = !DateTime.now().isBefore(expiresAt!);
      return Scaffold(
          appBar: AppBar(title: const Text('Xác minh đăng nhập')),
          body: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(children: [
                Text(
                    'Mã OTP đã gửi tới ${email.text.trim()}. Kiểm tra cả thư rác. Mã có hiệu lực 5 phút.'),
                const SizedBox(height: 20),
                TextField(
                    controller: otp,
                    enabled: !loading && !expired,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    autofillHints: const [AutofillHints.oneTimeCode],
                    decoration:
                        const InputDecoration(labelText: 'Mã OTP email')),
                if (expired)
                  const Text(
                      'Phiên xác minh hết hạn. Vui lòng quay lại đăng nhập.'),
                FilledButton(
                    onPressed: loading || expired ? null : () => verifyOtp(),
                    child: const Text('Xác minh và đăng nhập')),
                TextButton(
                    onPressed: loading || expired || remaining > 0
                        ? null
                        : () => verifyOtp(resend: true),
                    child: Text(remaining > 0
                        ? 'Gửi lại sau ${remaining}s'
                        : 'Gửi lại mã OTP')),
                TextButton(
                    onPressed: loading
                        ? null
                        : () {
                            timer?.cancel();
                            setState(() {
                              challenge = null;
                              otp.clear();
                            });
                          },
                    child: const Text('Quay lại đăng nhập')),
              ])));
    }
    return Scaffold(
        appBar: AppBar(title: const Text('RouteBite')),
        body: SafeArea(
            child: Center(
                child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Form(
                key: formKey,
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Card.filled(
                          child: Padding(
                              padding: const EdgeInsets.all(28),
                              child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Icon(Icons.restaurant_outlined,
                                        size: 40,
                                        color: theme.colorScheme.primary),
                                    const SizedBox(height: 24),
                                    Text('Món ngon trên\nđường bạn đi.',
                                        style: theme.textTheme.headlineLarge),
                                    const SizedBox(height: 12),
                                    const Text(
                                        'Đăng nhập để tìm quán tiện đường và ghé lấy món.'),
                                  ]))),
                      const SizedBox(height: 32),
                      Text('Chào mừng trở lại',
                          style: theme.textTheme.headlineSmall),
                      const SizedBox(height: 24),
                      TextFormField(
                          controller: email,
                          keyboardType: TextInputType.emailAddress,
                          autofillHints: const [AutofillHints.email],
                          textInputAction: TextInputAction.next,
                          decoration: const InputDecoration(
                              labelText: 'Email',
                              prefixIcon: Icon(Icons.mail_outline)),
                          validator: (value) =>
                              value == null || !value.contains('@')
                                  ? 'Nhập email hợp lệ'
                                  : null),
                      const SizedBox(height: 20),
                      TextFormField(
                          controller: password,
                          obscureText: obscure,
                          autofillHints: const [AutofillHints.password],
                          onFieldSubmitted: (_) => login(),
                          decoration: InputDecoration(
                              labelText: 'Mật khẩu',
                              prefixIcon: const Icon(Icons.lock_outline),
                              suffixIcon: IconButton(
                                  tooltip:
                                      obscure ? 'Hiện mật khẩu' : 'Ẩn mật khẩu',
                                  onPressed: () =>
                                      setState(() => obscure = !obscure),
                                  icon: Icon(obscure
                                      ? Icons.visibility_outlined
                                      : Icons.visibility_off_outlined))),
                          validator: (value) => value == null || value.isEmpty
                              ? 'Nhập mật khẩu'
                              : null),
                      const SizedBox(height: 28),
                      FilledButton.icon(
                          onPressed: loading ? null : login,
                          icon: loading
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2))
                              : const Icon(Icons.login),
                          label:
                              Text(loading ? 'Đang đăng nhập…' : 'Đăng nhập')),
                    ]),
              )),
        ))));
  }
}

class RouteSearchPage extends StatefulWidget {
  const RouteSearchPage({super.key});
  @override
  State<RouteSearchPage> createState() => _RouteSearchPageState();
}

class _RouteSearchPageState extends State<RouteSearchPage> {
  final fields = [
    TextEditingController(text: '10.7769'),
    TextEditingController(text: '106.7009'),
    TextEditingController(text: '10.7860'),
    TextEditingController(text: '106.6950')
  ];
  List<dynamic> restaurants = [];
  bool loading = false, searched = false;
  @override
  void dispose() {
    for (final field in fields) {
      field.dispose();
    }
    super.dispose();
  }

  Future<void> search() async {
    if (loading) return;
    final values =
        fields.map((field) => double.tryParse(field.text.trim())).toList();
    if (values.any((value) => value == null || !value.isFinite) ||
        values[0]!.abs() > 90 ||
        values[2]!.abs() > 90 ||
        values[1]!.abs() > 180 ||
        values[3]!.abs() > 180) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Vui lòng nhập tọa độ hợp lệ.')));
      return;
    }
    setState(() => loading = true);
    try {
      final data = await api.post('/search/route', {
        'pointA': {'latitude': values[0], 'longitude': values[1]},
        'pointB': {'latitude': values[2], 'longitude': values[3]},
        'radius': 500
      });
      if (mounted)
        setState(() {
          restaurants = data['restaurants'] as List<dynamic>;
          searched = true;
        });
    } catch (error) {
      if (error is SessionExpired && mounted) {
        Navigator.pushAndRemoveUntil(
            context,
            MaterialPageRoute<void>(builder: (_) => const LoginPage()),
            (_) => false);
        return;
      }
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$error')));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
        appBar: AppBar(title: const Text('Tìm quán tiện đường'), actions: [
          IconButton(
              tooltip: 'Đăng xuất',
              icon: const Icon(Icons.logout),
              onPressed: () async {
                await api.logout();
                if (context.mounted)
                  Navigator.pushAndRemoveUntil(
                      context,
                      MaterialPageRoute<void>(
                          builder: (_) => const LoginPage()),
                      (_) => false);
              }),
        ]),
        body: SafeArea(
            child: ListView(padding: const EdgeInsets.all(20), children: [
          Center(
              child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 760),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text('Hành trình của bạn',
                            style: theme.textTheme.headlineMedium),
                        const SizedBox(height: 8),
                        const Text(
                            'Khám phá quán trong phạm vi 500 m quanh tuyến đường.'),
                        const SizedBox(height: 24),
                        Card.filled(
                            child: Padding(
                                padding: const EdgeInsets.all(20),
                                child: Column(children: [
                                  for (var point = 0; point < 2; point++) ...[
                                    ListTile(
                                        contentPadding: EdgeInsets.zero,
                                        leading: Icon(point == 0
                                            ? Icons.trip_origin
                                            : Icons.location_on_outlined),
                                        title: Text(point == 0
                                            ? 'Điểm đi'
                                            : 'Điểm đến')),
                                    Row(children: [
                                      for (var coordinate = 0;
                                          coordinate < 2;
                                          coordinate++) ...[
                                        if (coordinate == 1)
                                          const SizedBox(width: 12),
                                        Expanded(
                                            child: TextField(
                                                controller: fields[
                                                    point * 2 + coordinate],
                                                keyboardType:
                                                    const TextInputType
                                                        .numberWithOptions(
                                                        decimal: true,
                                                        signed: true),
                                                decoration: InputDecoration(
                                                    labelText: coordinate == 0
                                                        ? 'Vĩ độ'
                                                        : 'Kinh độ'))),
                                      ]
                                    ]),
                                    const SizedBox(height: 16),
                                  ],
                                  SizedBox(
                                      width: double.infinity,
                                      child: FilledButton.icon(
                                          onPressed: loading ? null : search,
                                          icon: const Icon(Icons.search),
                                          label: Text(loading
                                              ? 'Đang tìm…'
                                              : 'Tìm quán'))),
                                ]))),
                        const SizedBox(height: 24),
                        if (loading) const LinearProgressIndicator(),
                        if (!loading && restaurants.isEmpty)
                          Padding(
                              padding: const EdgeInsets.all(24),
                              child: Column(children: [
                                Icon(Icons.travel_explore,
                                    size: 48, color: theme.colorScheme.primary),
                                const SizedBox(height: 16),
                                Text(
                                    searched
                                        ? 'Chưa tìm thấy quán trên tuyến này.'
                                        : 'Chọn hai điểm để bắt đầu khám phá.',
                                    textAlign: TextAlign.center),
                              ])),
                        for (final raw in restaurants)
                          Builder(builder: (context) {
                            final restaurant = raw as Map<String, dynamic>;
                            final distance = double.tryParse(
                                '${restaurant['distance_meters']}');
                            return Card.outlined(
                                child: ListTile(
                              contentPadding: const EdgeInsets.all(16),
                              leading: CircleAvatar(
                                  backgroundColor:
                                      theme.colorScheme.secondaryContainer,
                                  child: const Icon(Icons.restaurant)),
                              title: Text('${restaurant['name']}'),
                              subtitle: Text(
                                  '${restaurant['address']}\n${distance?.round() ?? 0} m từ tuyến · ★ ${restaurant['rating']}'),
                              isThreeLine: true,
                              trailing: const Icon(Icons.chevron_right),
                              onTap: () => Navigator.push(
                                  context,
                                  MaterialPageRoute<void>(
                                      builder: (_) => RestaurantPage(
                                          restaurant: restaurant))),
                            ));
                          }),
                      ]))),
        ])));
  }
}

class RestaurantPage extends StatelessWidget {
  const RestaurantPage({super.key, required this.restaurant});
  final Map<String, dynamic> restaurant;
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
        appBar: AppBar(title: const Text('Thông tin quán')),
        body: SafeArea(
            child: ListView(padding: const EdgeInsets.all(24), children: [
          Card.filled(
              child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.storefront_outlined,
                            size: 64, color: theme.colorScheme.primary),
                        const SizedBox(height: 24),
                        Text('${restaurant['name']}',
                            style: theme.textTheme.headlineLarge),
                        const SizedBox(height: 16),
                        Text('${restaurant['address']}'),
                        const SizedBox(height: 16),
                        Chip(
                            avatar: const Icon(Icons.star_outline, size: 18),
                            label: Text('${restaurant['rating'] ?? 0}')),
                      ]))),
          const SizedBox(height: 24),
          const Text(
              'Đặt món trên ứng dụng đang được hoàn thiện. Bạn có thể đặt món trên website RouteBite.'),
          const SizedBox(height: 16),
          const FilledButton(onPressed: null, child: Text('Đặt món — sắp có')),
        ])));
  }
}
