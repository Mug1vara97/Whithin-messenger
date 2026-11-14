//! AniLibria (AniLiberty) open API: catalog, releases and HLS episode links. Queries come from the user's
//! machine, like everything else in the player.

const API: &str = "https://aniliberty.top/api/v1/";

#[tauri::command]
pub async fn cinema_anilibria(path: String, query: Option<Vec<(String, String)>>) -> Result<serde_json::Value, String> {
    let path = path.trim_start_matches('/');
    if !(path.starts_with("anime/") || path.starts_with("app/")) || path.contains("..") {
        return Err("unsupported AniLibria path".into());
    }
    let mut url = url::Url::parse(API).and_then(|base| base.join(path)).map_err(|e| e.to_string())?;
    if let Some(query) = query {
        url.query_pairs_mut().extend_pairs(query);
    }
    let response = super::proxy::client()
        .get(url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("AniLibria недоступна: {e}"))?;
    let status = response.status();
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!("AniLibria ответила {status}"));
    }
    serde_json::from_slice(&bytes).map_err(|e| format!("AniLibria: неожиданный ответ ({e})"))
}
