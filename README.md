# ひとこと

自分だけが投稿し、訪問者はいいね・絵文字でリアクションできる個人用タイムラインです。コメント機能はありません。

公開版はSupabase認証を使います。メールアドレスとパスワード、Discord、GitHubをログイン方法として選べます。訪問者はSupabaseユーザーIDで識別されます。

訪問者用URLは `https://hitokoto-touma816.basicoak.chatgpt.site/?view=visitor` です。投稿者画面の「訪問者URLをコピー」からも取得できます。

## 起動

Node.js 20以上で動作します。画像・アイコン・日本語フォントは同梱され、実行時に外部サービスへの接続は不要です。

```sh
npm ci
npm run dev -- --host 0.0.0.0 --port 4173 --strictPort
```

ローカルで投稿者画面まで確認する場合は、起動環境の `OWNER_PASSWORD` を `private-preview` に設定してください。公開版ではSupabaseで認証された所有者メールを判定し、一般訪問者には投稿・削除・プロフィール変更を表示しません。

## 機能

- 500文字までのつぶやき、画像のみの投稿、最大4枚の画像添付。
- アイコン、表示名、ユーザー名を投稿者画面から変更できます。
- 画像のプレビュー・取り消し・拡大表示。JPEG / PNG / WebP / GIF対応。大きな静止画は送信前に1600px以内へ縮小されます。
- ログイン後に使えるいいねと19種類の絵文字。訪問者ごとに追加・取り消しできます。
- メールアドレスとパスワード、Discord、GitHubのアカウントでログインできます。
- 投稿者だけが投稿・削除でき、訪問者向け表示への切り替えも可能です。
- PC・タブレット・スマートフォン対応。

投稿・画像・リアクションは `data/posts.json` に保存されます（Git管理対象外）。初回はサンプル投稿が表示されます。実際の投稿やリアクションを行うと保存されます。保存先は `DATA_FILE` で変更できます。現在はローカルプレビュー用の単一Nodeプロセス構成です。

## Supabase認証プロバイダーの設定

Supabase Dashboardの **Authentication → Providers** でEmail、Discord、GitHubを有効にします。Discord・GitHubは各Developer PortalでOAuthアプリを作り、Callback URLに `https://ystlgxxqbuchwenyifwg.supabase.co/auth/v1/callback` を登録してから、Client IDとSecretをSupabaseへ設定してください。ソーシャルログインはProvider設定を保存した後に使用できます。Email認証で確認メールを有効にしている場合、新規登録時だけ確認操作が必要です。投稿者はSQL設定で指定したメールアドレスが認証プロバイダーから返されるアカウントでログインします。

Supabase Dashboardの **Authentication → URL Configuration** には、Site URLとして `https://hitokoto-touma816.basicoak.chatgpt.site` を設定し、Redirect URLsに `https://hitokoto-touma816.basicoak.chatgpt.site/**` を追加してください。

## Supabaseの共有保存とリアルタイム更新

公開版で投稿を全訪問者へ共有し、投稿・リアクションを即時反映するには、Supabase Dashboardの「SQL Editor」で [`supabase/setup.sql`](supabase/setup.sql) を実行します。実行前に `YOUR_OWNER_EMAIL@example.com` を投稿者本人がメールログインに使うアドレスへ変更してください。

設定後は投稿・プロフィール・リアクションをSupabaseへ保存し、Realtimeで開いている画面へ反映します。テーブルが未設定の間は、壊れた画面を出さないためブラウザ内保存へ自動的に切り替わります。Sites用のAPIアダプターは [`deployment/preview-api.js`](deployment/preview-api.js) にあります。

## 検証

```sh
npm test
```

APIテストとブラウザ操作確認を実施済みです。デザイン確認は `design-qa.md`、スクリーンショットは `qa/` を参照してください。

初期の表示名は「とうま」、ユーザー名は `@touma816` です。プロフィール欄を押すと、投稿者だけが変更できます。
