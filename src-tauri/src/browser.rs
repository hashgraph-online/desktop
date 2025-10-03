use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::VecDeque;
use std::sync::Arc;
use tauri::path::BaseDirectory;
use tauri::utils::config::WebviewUrl;
use tauri::webview::{NewWindowResponse, PageLoadEvent, Webview, WebviewBuilder};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Runtime, Size, Url};
use tokio::sync::{Mutex, oneshot};

const DEFAULT_URL: &str = "https://hedera.kiloscribe.com";
const DEEP_LINK_SCHEMES: [&str; 4] = ["hashpack", "hashconnect", "hedera-wallet-connect", "wc"];
const HASHPACK_HOST: &str = "link.hashpack.app";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserStateDto {
    pub requested_url: String,
    pub current_url: String,
    pub title: String,
    pub is_loading: bool,
    pub can_go_back: bool,
    pub can_go_forward: bool,
    pub last_error: Option<String>,
}

impl Default for BrowserStateDto {
    fn default() -> Self {
        Self {
            requested_url: DEFAULT_URL.to_string(),
            current_url: DEFAULT_URL.to_string(),
            title: String::new(),
            is_loading: false,
            can_go_back: false,
            can_go_forward: false,
            last_error: None,
        }
    }
}

#[derive(Clone, Copy)]
struct BrowserBounds {
    position: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
}

#[derive(Clone)]
struct PendingNavigation {
    url: String,
    target_index: Option<usize>,
}

struct BrowserInner<R: Runtime> {
    webview: Option<Webview<R>>,
    state: BrowserStateDto,
    bounds: Option<BrowserBounds>,
    attached: bool,
    history: VecDeque<String>,
    history_index: usize,
    pending_navigation: Option<PendingNavigation>,
}

impl<R: Runtime> Default for BrowserInner<R> {
    fn default() -> Self {
        Self {
            webview: None,
            state: BrowserStateDto::default(),
            bounds: None,
            attached: false,
            history: VecDeque::from([DEFAULT_URL.to_string()]),
            history_index: 0,
            pending_navigation: None,
        }
    }
}

#[derive(Clone)]
pub struct BrowserManager<R: Runtime> {
    inner: Arc<Mutex<BrowserInner<R>>>,
    default_url: String,
}

impl<R: Runtime> BrowserManager<R> {
    pub fn new(default_url: Option<String>) -> Self {
        let resolved_default = default_url.unwrap_or_else(|| DEFAULT_URL.to_string());
        let manager = Self {
            inner: Arc::new(Mutex::new(BrowserInner::default())),
            default_url: resolved_default,
        };
        let mut guard = manager.inner.blocking_lock();
        guard.state.requested_url = manager.default_url.clone();
        guard.state.current_url = manager.default_url.clone();
        guard.history = VecDeque::from([manager.default_url.clone()]);
        guard.history_index = guard.history.len().saturating_sub(1);
        drop(guard);
        manager
    }

    pub async fn attach(&self, app: &AppHandle<R>) -> Result<(), String> {
        let shared_inner = self.inner.clone();
        let default_url = self.default_url.clone();
        self.run_on_main(app, move |app_handle, inner| {
            if inner.attached {
                log::info!("browser.attach ignored: already attached");
                return Ok(());
            }
            let webview = BrowserManager::ensure_webview_with(
                shared_inner.clone(),
                default_url.clone(),
                app_handle,
                inner,
            )?;
            if let Some(bounds) = inner.bounds {
                apply_bounds(&webview, bounds)?;
            }
            log::info!("browser.attach show webview");
            webview.show().map_err(map_error)?;
            inner.attached = true;
            Ok(())
        })
        .await
    }

    pub async fn detach(&self, app: &AppHandle<R>) -> Result<(), String> {
        self.run_on_main(app, |_app_handle, inner| {
            if !inner.attached {
                log::info!("browser.detach ignored: already detached");
                return Ok(());
            }
            if let Some(webview) = inner.webview.as_ref() {
                log::info!("browser.detach hide webview");
                webview.hide().map_err(map_error)?;
            }
            inner.attached = false;
            Ok(())
        })
        .await
    }

    pub async fn navigate(&self, app: &AppHandle<R>, url: String) -> Result<(), String> {
        self.run_on_main(app, |_app_handle, inner| {
            let webview = inner
                .webview
                .clone()
                .ok_or_else(|| "Browser view not attached".to_string())?;
            let parsed = Url::parse(&url).map_err(map_error)?;
            inner.pending_navigation = Some(PendingNavigation {
                url: url.clone(),
                target_index: None,
            });
            inner.state.requested_url = url;
            inner.state.is_loading = true;
            inner.state.last_error = None;
            inner_update_flags(inner);
            webview.navigate(parsed).map_err(map_error)
        })
        .await
    }

    pub async fn reload(&self, app: &AppHandle<R>) -> Result<(), String> {
        self.run_on_main(app, |_app_handle, inner| {
            let webview = inner
                .webview
                .clone()
                .ok_or_else(|| "Browser view not attached".to_string())?;
            inner.state.is_loading = true;
            inner.state.last_error = None;
            webview.reload().map_err(map_error)
        })
        .await
    }

    pub async fn go_back(&self, app: &AppHandle<R>) -> Result<(), String> {
        self.run_on_main(app, |_app_handle, inner| {
            if inner.history_index == 0 {
                return Ok(());
            }
            let target_index = inner.history_index - 1;
            let url = inner
                .history
                .get(target_index)
                .cloned()
                .ok_or_else(|| "History missing entry".to_string())?;
            let webview = inner
                .webview
                .clone()
                .ok_or_else(|| "Browser view not attached".to_string())?;
            let parsed = Url::parse(&url).map_err(map_error)?;
            inner.pending_navigation = Some(PendingNavigation {
                url: url.clone(),
                target_index: Some(target_index),
            });
            inner.state.requested_url = url;
            inner.state.is_loading = true;
            inner.state.last_error = None;
            webview.navigate(parsed).map_err(map_error)
        })
        .await
    }

    pub async fn go_forward(&self, app: &AppHandle<R>) -> Result<(), String> {
        self.run_on_main(app, |_app_handle, inner| {
            if inner.history_index + 1 >= inner.history.len() {
                return Ok(());
            }
            let target_index = inner.history_index + 1;
            let url = inner
                .history
                .get(target_index)
                .cloned()
                .ok_or_else(|| "History missing entry".to_string())?;
            let webview = inner
                .webview
                .clone()
                .ok_or_else(|| "Browser view not attached".to_string())?;
            let parsed = Url::parse(&url).map_err(map_error)?;
            inner.pending_navigation = Some(PendingNavigation {
                url: url.clone(),
                target_index: Some(target_index),
            });
            inner.state.requested_url = url;
            inner.state.is_loading = true;
            inner.state.last_error = None;
            webview.navigate(parsed).map_err(map_error)
        })
        .await
    }

    pub async fn capture_context(&self, app: &AppHandle<R>) -> Result<Option<Value>, String> {
        let script = include_str!("browser/page_context.js");
        match self.execute_js(app, script.to_string()).await {
            Ok(value) => Ok(Some(value)),
            Err(e) => {
                log::warn!("capture_context: failed to capture page context - {}", e);
                Err(e)
            }
        }
    }

    pub async fn set_bounds(
        &self,
        app: &AppHandle<R>,
        bounds: BoundsPayload,
    ) -> Result<(), String> {
        self.run_on_main(app, |_app_handle, inner| {
            let converted = convert_bounds(bounds);
            if let Some(webview) = inner.webview.as_ref() {
                apply_bounds(webview, converted)?;
            }
            inner.bounds = Some(converted);
            Ok(())
        })
        .await
    }

    pub async fn set_layout(
        &self,
        app: &AppHandle<R>,
        layout: LayoutPayload,
    ) -> Result<(), String> {
        self.run_on_main(app, |_app_handle, inner| {
            let converted = layout_to_bounds(layout);
            if let Some(webview) = inner.webview.as_ref() {
                apply_bounds(webview, converted)?;
            }
            inner.bounds = Some(converted);
            Ok(())
        })
        .await
    }

    pub async fn get_state(&self) -> Result<BrowserStateDto, String> {
        let guard = self.inner.lock().await;
        Ok(guard.state.clone())
    }

    pub async fn open_devtools(&self, app: &AppHandle<R>) -> Result<(), String> {
        self.run_on_main(app, |app_handle, inner| {
            if inner.webview.is_none() {
                return Err("Browser view not attached".to_string());
            }
            app_handle
                .get_webview_window("main")
                .unwrap()
                .open_devtools();
            Ok(())
        })
        .await
    }

    pub async fn execute_js(
        &self,
        _app: &AppHandle<R>,
        script: String,
    ) -> Result<serde_json::Value, String> {
        // Use try_lock with retry to avoid deadlock with event handlers
        let webview = {
            let mut retries = 0;
            loop {
                match self.inner.try_lock() {
                    Ok(guard) => {
                        break guard
                            .webview
                            .clone()
                            .ok_or_else(|| "Browser view not attached".to_string())?;
                    }
                    Err(_) => {
                        if retries > 50 {
                            return Err("Failed to acquire lock after retries".to_string());
                        }
                        retries += 1;
                        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
                    }
                }
            }
        };

        evaluate_script(&webview, script).await
    }

    async fn run_on_main<T, F>(&self, app: &AppHandle<R>, f: F) -> Result<T, String>
    where
        T: Send + 'static,
        F: FnOnce(&AppHandle<R>, &mut BrowserInner<R>) -> Result<T, String> + Send + 'static,
    {
        let inner = self.inner.clone();
        let (tx, rx) = oneshot::channel();
        let app_handle = app.clone();
        let _ = app.run_on_main_thread(move || {
            // Use blocking_lock since we're on the main thread already
            // Using lock().await inside block_on causes deadlocks with event handlers
            let mut guard = inner.blocking_lock();
            let result = f(&app_handle, &mut *guard);
            let _ = tx.send(result);
        });
        rx.await.map_err(|e| e.to_string())?
    }

    fn ensure_webview(
        &self,
        app: &AppHandle<R>,
        inner: &mut BrowserInner<R>,
    ) -> Result<Webview<R>, String> {
        Self::ensure_webview_with(self.inner.clone(), self.default_url.clone(), app, inner)
    }

    fn ensure_webview_with(
        shared_inner: Arc<Mutex<BrowserInner<R>>>,
        default_url: String,
        app: &AppHandle<R>,
        inner: &mut BrowserInner<R>,
    ) -> Result<Webview<R>, String> {
        if let Some(webview) = inner.webview.clone() {
            return Ok(webview);
        }

        let window = app
            .get_window("main")
            .ok_or_else(|| "Main window not available".to_string())?;

        let initial_size = window.inner_size().map_err(map_error)?;
        let logical_position = initial_size.to_logical::<f64>(1.0);
        let data_dir = app
            .path()
            .resolve("browser", BaseDirectory::AppData)
            .map_err(map_error)?;

        const DEFAULT_USER_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

        let builder = WebviewBuilder::new(
            "moonscape-browser",
            WebviewUrl::External(Url::parse(&default_url).map_err(map_error)?),
        )
        .data_directory(data_dir)
        .user_agent(DEFAULT_USER_AGENT)
        .focused(true)
        .auto_resize()
        .on_navigation(|target_url| {
            if should_intercept_navigation(&target_url) {
                let external = target_url.as_str().to_string();
                log::info!("Intercepting external navigation for {}", external);
                if let Err(error) = open::that(&external) {
                    log::warn!(
                        "Failed to open intercepted navigation URL {}: {}",
                        external,
                        error
                    );
                }
                return false;
            }
            true
        })
        .on_new_window(|url, _features| {
            if should_intercept_navigation(&url) {
                let external = url.as_str().to_string();
                log::info!("Intercepting external window for {}", external);
                if let Err(error) = open::that(&external) {
                    log::warn!(
                        "Failed to open intercepted window URL {}: {}",
                        external,
                        error
                    );
                }
                return NewWindowResponse::Deny;
            }
            NewWindowResponse::Allow
        })
        .on_page_load(page_load_handler(shared_inner.clone()))
        .on_document_title_changed(title_change_handler(shared_inner.clone()));

        let webview = window
            .add_child(
                builder,
                tauri::LogicalPosition::new(0.0, 0.0),
                tauri::LogicalSize::new(logical_position.width, logical_position.height),
            )
            .map_err(map_error)?;

        webview.hide().map_err(map_error)?;
        inner.webview = Some(webview.clone());
        Ok(webview)
    }
}

fn apply_bounds<R: Runtime>(webview: &Webview<R>, bounds: BrowserBounds) -> Result<(), String> {
    webview.set_position(bounds.position).map_err(map_error)?;
    webview
        .set_size(Size::Physical(bounds.size))
        .map_err(map_error)
}

fn map_error<E: std::fmt::Display>(error: E) -> String {
    error.to_string()
}

fn should_intercept_navigation(url: &Url) -> bool {
    is_deep_link_scheme(url) || is_hashpack_link(url)
}

fn is_deep_link_scheme(url: &Url) -> bool {
    DEEP_LINK_SCHEMES
        .iter()
        .any(|scheme| url.scheme().eq_ignore_ascii_case(scheme))
}

fn is_hashpack_link(url: &Url) -> bool {
    if url.scheme() != "https" {
        return false;
    }
    if let Some(host) = url.host_str() {
        let lowered = host.to_ascii_lowercase();
        if lowered == HASHPACK_HOST {
            return true;
        }
        if lowered.ends_with(HASHPACK_HOST) {
            if let Some(prefix) = lowered.strip_suffix(HASHPACK_HOST) {
                return prefix.ends_with('.');
            }
        }
    }
    false
}

#[derive(Deserialize)]
pub struct BoundsPayload {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LayoutPayload {
    toolbar_height: f64,
    bookmark_height: f64,
    window_bounds: LayoutWindowBounds,
    assistant_panel: Option<AssistantPanelPayload>,
    device_pixel_ratio: Option<f64>,
}

#[derive(Deserialize)]
struct LayoutWindowBounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AssistantPanelPayload {
    is_open: bool,
    dock: AssistantDock,
    width: f64,
    height: f64,
}

#[derive(Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum AssistantDock {
    Left,
    Right,
    Bottom,
}

fn convert_bounds(payload: BoundsPayload) -> BrowserBounds {
    let x = payload.x.max(0.0).round() as i32;
    let y = payload.y.max(0.0).round() as i32;
    let width = payload.width.max(0.0).round() as u32;
    let height = payload.height.max(0.0).round() as u32;
    BrowserBounds {
        position: PhysicalPosition::new(x, y),
        size: PhysicalSize::new(width.max(1), height.max(1)),
    }
}

fn layout_to_bounds(payload: LayoutPayload) -> BrowserBounds {
    let window_width = payload.window_bounds.width.max(0.0);
    let window_height = payload.window_bounds.height.max(0.0);
    let toolbar = payload.toolbar_height.max(0.0);
    let bookmark = payload.bookmark_height.max(0.0);
    let top_offset = toolbar + bookmark;
    let mut x = 0.0;
    let mut width = window_width;
    let mut height = (window_height - top_offset).max(0.0);
    if let Some(panel) = payload.assistant_panel {
        if panel.is_open {
            match panel.dock {
                AssistantDock::Left => {
                    let dock_width = panel.width.max(0.0);
                    x += dock_width;
                    width = (width - dock_width).max(0.0);
                }
                AssistantDock::Right => {
                    let dock_width = panel.width.max(0.0);
                    width = (width - dock_width).max(0.0);
                }
                AssistantDock::Bottom => {
                    // Maintain full height; assistant panel renders as overlay.
                }
            }
        }
    }
    let device_pixel_ratio = payload.device_pixel_ratio.unwrap_or(1.0).max(0.1);
    let absolute_x = ((x + payload.window_bounds.x) * device_pixel_ratio)
        .round()
        .max(0.0) as i32;
    let absolute_y = (((top_offset) + payload.window_bounds.y) * device_pixel_ratio)
        .round()
        .max(0.0) as i32;
    let absolute_width = (width * device_pixel_ratio).round().max(1.0) as u32;
    let absolute_height = (height * device_pixel_ratio).round().max(1.0) as u32;
    BrowserBounds {
        position: PhysicalPosition::new(absolute_x, absolute_y),
        size: PhysicalSize::new(absolute_width, absolute_height),
    }
}

fn inner_update_flags<R: Runtime>(inner: &mut BrowserInner<R>) {
    inner.state.can_go_back = inner.history_index > 0 && !inner.history.is_empty();
    inner.state.can_go_forward = inner.history_index + 1 < inner.history.len();
}

fn page_load_handler<R: Runtime>(
    inner: Arc<Mutex<BrowserInner<R>>>,
) -> impl Fn(Webview<R>, tauri::webview::PageLoadPayload<'_>) + Send + Sync + 'static {
    move |webview, payload| {
        let mut guard = inner.blocking_lock();
        let url = payload.url().to_string();
        match payload.event() {
            PageLoadEvent::Started => {
                log::info!("browser_on_page_load started: {}", url);
                handle_navigation_started(&mut *guard, &url);
                guard.state.is_loading = true;
                guard.state.last_error = None;
                guard.state.requested_url = url.clone();
                inner_update_flags(&mut *guard);
            }
            PageLoadEvent::Finished => {
                log::info!("browser_on_page_load finished: {}", url);
                guard.state.current_url = url.clone();
                guard.state.is_loading = false;
                inner_update_flags(&mut *guard);
            }
        }
        let snapshot = guard.state.clone();
        drop(guard);
        let _ = webview
            .app_handle()
            .emit_to("main", "browser_state", snapshot);
    }
}

fn title_change_handler<R: Runtime>(
    inner: Arc<Mutex<BrowserInner<R>>>,
) -> impl Fn(Webview<R>, String) + Send + 'static {
    move |webview, title| {
        let mut guard = inner.blocking_lock();
        log::info!("browser_title_changed -> {}", title);
        guard.state.title = title.clone();
        let snapshot = guard.state.clone();
        drop(guard);
        let _ = webview
            .app_handle()
            .emit_to("main", "browser_state", snapshot);
    }
}

fn handle_navigation_started<R: Runtime>(inner: &mut BrowserInner<R>, url: &str) {
    if let Some(pending) = inner.pending_navigation.take() {
        if let Some(index) = pending.target_index {
            inner.history_index = index;
        } else {
            truncate_forward(inner);
            inner.history.push_back(url.to_string());
            inner.history_index = inner.history.len().saturating_sub(1);
        }
        return;
    }

    if inner.history_index > 0 {
        if let Some(previous) = inner.history.get(inner.history_index - 1) {
            if previous == url {
                inner.history_index -= 1;
                return;
            }
        }
    }

    if inner.history_index + 1 < inner.history.len() {
        if let Some(next) = inner.history.get(inner.history_index + 1) {
            if next == url {
                inner.history_index += 1;
                return;
            }
        }
    }

    truncate_forward(inner);
    inner.history.push_back(url.to_string());
    inner.history_index = inner.history.len().saturating_sub(1);
}

fn truncate_forward<R: Runtime>(inner: &mut BrowserInner<R>) {
    let retain_len = inner.history_index + 1;
    while inner.history.len() > retain_len {
        inner.history.pop_back();
    }
}

async fn evaluate_script<R: Runtime>(
    webview: &Webview<R>,
    script: String,
) -> Result<serde_json::Value, String> {
    // Wrap in try-catch and JSON.stringify for WebKit compatibility
    // Note: This executes synchronously - async operations in the script won't work with evaluateJavaScript
    // The script is expected to be an expression that evaluates to a value (can be an IIFE)
    let wrapped = format!(
        "(function() {{ try {{ const result = {}; return JSON.stringify({{ __result: result }}); }} catch (error) {{ return JSON.stringify({{ __hashgraphError: String(error && error.message ? error.message : error) }}); }} }})()",
        script
    );
    let (tx, rx) = oneshot::channel();
    if let Err(error) = evaluate_platform(webview.clone(), wrapped, tx) {
        return Err(error);
    }
    let response = rx
        .await
        .map_err(|_| "Script evaluation interrupted".to_string())??;
    if let Some(error) = response
        .get("__hashgraphError")
        .and_then(|value| value.as_str())
    {
        return Err(error.to_string());
    }
    Ok(response
        .get("__result")
        .cloned()
        .unwrap_or(serde_json::Value::Null))
}

fn evaluate_platform<R: Runtime>(
    webview: Webview<R>,
    script: String,
    sender: oneshot::Sender<Result<serde_json::Value, String>>,
) -> Result<(), String> {
    webview
        .with_webview(move |platform| {
            #[cfg(target_os = "macos")]
            {
                evaluate_macos(platform, script, sender);
            }

            #[cfg(not(target_os = "macos"))]
            {
                let _ = sender.send(Err(
                    "executeJavaScript is currently supported on macOS only".to_string(),
                ));
            }
        })
        .map_err(map_error)
}

#[cfg(target_os = "macos")]
fn evaluate_macos(
    platform: tauri::webview::PlatformWebview,
    script: String,
    sender: oneshot::Sender<Result<serde_json::Value, String>>,
) {
    use objc2_foundation::NSString;
    use objc2_web_kit::WKWebView;
    use std::sync::Mutex as StdMutex;

    // Wrap sender in Arc<Mutex<Option>> so it can be moved into Fn closure
    let sender = Arc::new(StdMutex::new(Some(sender)));

    unsafe {
        let webview_ptr = platform.inner();
        if webview_ptr.is_null() {
            if let Ok(mut guard) = sender.lock() {
                if let Some(s) = guard.take() {
                    let _ = s.send(Err("Webview unavailable".to_string()));
                }
            }
            return;
        }
        let webview = &*(webview_ptr as *mut WKWebView);
        // Script is already wrapped by evaluate_script, just use it as-is
        let ns_script = NSString::from_str(&script);

        // Clone Arc for the block - this keeps sender alive during callback
        let sender_clone = sender.clone();

        webview.evaluateJavaScript_completionHandler(
            &ns_script,
            Some(
                &block2::RcBlock::new(
                    move |value: *mut objc2::runtime::AnyObject,
                          error: *mut objc2_foundation::NSError| {
                        let send_result = |result: Result<serde_json::Value, String>| {
                            if let Ok(mut guard) = sender_clone.lock() {
                                if let Some(s) = guard.take() {
                                    let _ = s.send(result);
                                }
                            }
                        };

                        if !error.is_null() {
                            unsafe {
                                let err = &*(error as *const objc2_foundation::NSError);
                                let message = err.localizedDescription().to_string();
                                send_result(Err(message));
                            }
                            return;
                        }

                        if value.is_null() {
                            send_result(Ok(serde_json::Value::Null));
                            return;
                        }

                        // Try to get as NSString
                        if let Some(retained_value) =
                            (unsafe { objc2::rc::Retained::retain(value) })
                        {
                            if let Ok(string) =
                                retained_value.downcast::<objc2_foundation::NSString>()
                            {
                                let text = string.to_string();
                                match serde_json::from_str::<serde_json::Value>(&text) {
                                    Ok(parsed) => {
                                        if parsed.get("__hashgraphError").is_some() {
                                            let message = parsed
                                                .get("__hashgraphError")
                                                .and_then(|v| v.as_str())
                                                .unwrap_or("Script error");
                                            send_result(Err(message.to_string()));
                                        } else {
                                            send_result(Ok(parsed));
                                        }
                                    }
                                    Err(parse_error) => {
                                        send_result(Err(parse_error.to_string()));
                                    }
                                }
                                return;
                            }
                        }
                        send_result(Ok(serde_json::Value::Null));
                    },
                )
                .copy(),
            ),
        );
    }
}
