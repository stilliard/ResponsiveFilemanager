# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, etc.) when working with code in this repository.

## What this is

Responsive FileManager: a PHP + jQuery file manager used standalone or embedded as a TinyMCE 4.x / CKEditor plugin. No PHP framework — plain procedural PHP with session-based state, served directly by Apache/PHP.

## Build, lint, and test commands

```
yarn install               # install node_modules
yarn build                 # compile assets via Laravel Mix (webpack) — dev build
yarn dist                  # yarn clean && mix --production — production build
yarn clean                 # remove compiled css/js/plugin.min.js outputs

composer install           # install Psalm (dev-only; the app has no runtime PHP deps)
composer run psalm         # baselined static analysis — blocking; fails only on issues not in psalm-baseline.xml
composer run psalm-taint   # taint-mode security analysis (tracks $_GET/$_POST/uploaded filenames to filesystem/curl/include sinks) — informational, non-blocking

yarn test:e2e               # Playwright end-to-end tests (tests/e2e/) — starts its own PHP built-in server, no manual setup needed
```

There's no PHP linter/formatter beyond `.php_cs.dist` (php-cs-fixer, PSR2, scoped only to `filemanager/lang`).

Psalm's baseline (`psalm-baseline.xml`) freezes all pre-existing issues so CI stays green; only newly introduced issues in changed code fail `composer run psalm`. To regenerate the baseline after intentionally touching flagged code: `composer run psalm-baseline` (inspect the diff before committing — don't blindly regenerate to silence a real new issue). The taint-analysis pass is separate and not baselined, since surfacing new taint findings is the point — it currently reports pre-existing, mostly-mitigated findings (e.g. `checkRelativePath()` sanitizes paths but Psalm doesn't know that) and is deliberately run locally only, not in CI (`.github/workflows/ci.yml` runs PHP lint, baselined Psalm, the asset build, and the Playwright suite on pull requests).

The Playwright suite (`tests/e2e/`) covers: the file manager loading and rendering its listing, creating a folder through the UI, and uploading a file through the UI — each against a live `php -S` server Playwright starts itself (see `playwright.config.js`). **CWD gotcha:** `config/config.php`'s `current_path => '../source/'` resolves relative to the PHP process's working directory, not the script's location, so the test server is launched with `cwd: './filemanager'` — changing that `cwd` will silently break where uploads/folders land. Each test creates a uniquely-named scratch folder under `source/` and deletes it in teardown (`tests/e2e/fixtures.js`), so parallel runs don't collide and nothing is left behind.

Asset source lives in `resources/assets/{js,less}`; `webpack.mix.js` defines every compiled bundle and its output path (e.g. `resources/assets/js/plugin.js` → `filemanager/plugin.min.js`, `resources/assets/js/plugin_responsivefilemanager_plugin.js` → `tinymce/plugins/responsivefilemanager/plugin.min.js`). Never hand-edit compiled output in `filemanager/js/`, `filemanager/css/`, `filemanager/plugin.min.js`, or `tinymce/plugins/*/plugin.min.js` — edit the source in `resources/assets/` and rebuild.

## Architecture

### Request flow

- `filemanager/dialog.php` — main entry point/UI shell. Starts the session (`$_SESSION['RF']`), handles the initial file upload form post, resolves the current folder (`fldr` param) via `checkRelativePath()`, and renders the file browser HTML.
- `filemanager/ajax_calls.php` — AJAX endpoint dispatched by a `case`/action switch (view, filter, sort, save_img, extract, media_preview, copy_cut, chmod, get_lang, change_lang, get_file, etc.) for interactions that return data without full navigation.
- `filemanager/execute.php` — AJAX endpoint dispatched by action switch for state-mutating file/folder operations (delete_file(s), delete_folder, create_folder, rename_folder, create_file, rename_file, duplicate_file, paste_clipboard, chmod, save_text_file).
- `filemanager/upload.php` / `UploadHandler.php` — file upload handling (blueimp jQuery-File-Upload server-side handler).
- `filemanager/include/utils.php` — shared helpers; every file that includes it immediately dies with `forbidden` unless `$_SESSION['RF']['verify'] === 'RESPONSIVEfilemanager'`, i.e. `dialog.php` must run first to establish the session before ajax_calls/execute endpoints will do anything. Also has `checkRelativePath()` / `checkRelativePathPartial()`, the path-traversal guard used everywhere a `fldr`/path param is accepted.
- `filemanager/include/Response.php` — minimal Response class fallback used when Laravel's `Illuminate\Http\Response` isn't available (this app can be dropped into a Laravel app or run standalone).
- `filemanager/include/php_image_magician.php` — image resize/manipulation library used for thumbnail generation and image editing.
- `filemanager/include/FtpClient.php`, `FtpWrapper.php`, `ftp_class.php` — optional FTP-backed storage backend (BETA), used when `ftp_host` is configured.

### Configuration

- `filemanager/config/config.php` — the single source of config (`$config` array + top-level constants like `USE_ACCESS_KEYS`, `DEBUG_ERROR_MESSAGE`). Key settings: `upload_dir`/`current_path` (upload folder), `thumbs_base_path`/`thumbs_upload_dir` (must NOT be inside the upload folder), FTP settings, size/permission limits, icon theme, language.
- Per-folder overrides: individual folders inside the upload root can carry their own `config.php` copying a subset of these keys to customize behavior per-folder (documented inline in `config.php`).
- Access keys (`USE_ACCESS_KEYS` + `access_keys`) gate access via an `akey` GET param — checked at the very top of `dialog.php` before anything else runs.

### Frontend

- `filemanager/js/include.js` — the main filemanager UI script (built from `resources/assets/js/include.js`); everything else in `filemanager/js/` (`plugins.js`, `tui-image-editor.js`, `load_more.js`, jQuery-File-Upload family, modernizr) is a compiled vendor bundle or supporting script wired together via `webpack.mix.js`.
- `filemanager/plugin.min.js` — the standalone integration script consumers embed to open the file manager dialog (e.g. from a CMS), built from `resources/assets/js/plugin.js`.
- `tinymce/plugins/responsivefilemanager/plugin.min.js` — the TinyMCE 4.x plugin adapter, built from `resources/assets/js/plugin_responsivefilemanager_plugin.js`.
- Image editing in the browser uses TUI Image Editor (`tui-image-editor.js` bundle); legacy Aviary-style editing references may still appear in docs/config but TUI is the active editor.
- Styling: LESS in `resources/assets/less/{style.less,rtl-style.less}` compiles to `filemanager/css/style.css` / `rtl-style.css`, bundled with several vendor CSS files (bootstrap 2.x, bootstrap-modal, featherlight, jquery-contextmenu, tui-color-picker, tui-image-editor).

### Storage layout (default/local backend)

```
source/    upload root (served at $config['upload_dir'])
thumbs/    generated thumbnails (must live outside source/)
filemanager/  app code
tinymce/plugins/responsivefilemanager/  TinyMCE plugin build output
```

FTP mode remaps these onto `ftp_base_folder` + `ftp_temp_folder`/`ftp_thumbs_dir` instead of local disk — see the FTP section of `config.php`.

## Compatibility notes

- PHP 7.4+ is the stated minimum; keep changes compatible with plain procedural PHP (no framework assumed), though `Response.php` shows the app is designed to also work when embedded inside a Laravel app.
- This project has real production users embedding it via TinyMCE/CKEditor and as a standalone manager — avoid breaking `config.php` key names/shapes, the ajax action names in `ajax_calls.php`/`execute.php`, or the public JS API surface (`plugin.min.js`, `include.js`) without a strong reason, since third-party integrations depend on them.
- License is CC-BY-NC-3.0 (non-commercial) — be mindful of this when adding dependencies or reusing external code.
