import UIKit
import Capacitor
import WebKit

/**
 * Capacitor の WKWebView 標準ではピンチズームが無効化されている。
 * このカスタム VC で scrollView のズーム設定を上書きして 2 本指ピンチズームを有効にする。
 *
 * Storyboard の Main.storyboard で BridgeViewController の Class を
 * `ZoomableViewController` に変更することで適用される。
 */
class ZoomableViewController: CAPBridgeViewController, UIScrollViewDelegate {

    override func viewDidLoad() {
        super.viewDidLoad()
        configureZoom()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // 念のため viewDidAppear でも再設定 (WebView が遅延生成されるケース対応)
        configureZoom()
    }

    private func configureZoom() {
        guard let webView = self.webView else { return }
        let scrollView = webView.scrollView
        scrollView.minimumZoomScale = 1.0
        scrollView.maximumZoomScale = 5.0
        scrollView.bouncesZoom = true
        scrollView.delegate = self
        scrollView.pinchGestureRecognizer?.isEnabled = true
    }

    // UIScrollViewDelegate: ズーム可能にするため (デフォルトでは nil 返すので明示的に WebView の中身を返す)
    func viewForZooming(in scrollView: UIScrollView) -> UIView? {
        return webView?.scrollView.subviews.first
    }
}
