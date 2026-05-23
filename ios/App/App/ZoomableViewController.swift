import UIKit
import Capacitor

/**
 * Capacitor の WKWebView 標準ではピンチズーム無効。
 * このカスタム VC で scrollView の zoom scale 範囲だけ拡張する。
 *
 * 重要: scrollView.delegate は上書きしない (Capacitor 内部の delegate を維持)
 * viewForZooming も実装しない (WKWebView 内部実装を使う)
 *
 * これによりレイアウトを壊さずにピンチズームを許可できる。
 */
class ZoomableViewController: CAPBridgeViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        DispatchQueue.main.async { [weak self] in
            self?.enablePinchZoom()
        }
    }

    private func enablePinchZoom() {
        guard let webView = self.webView else { return }
        // zoom scale 範囲のみ設定。delegate / viewForZooming は触らない。
        webView.scrollView.minimumZoomScale = 1.0
        webView.scrollView.maximumZoomScale = 5.0
        webView.scrollView.bouncesZoom = true
    }
}
