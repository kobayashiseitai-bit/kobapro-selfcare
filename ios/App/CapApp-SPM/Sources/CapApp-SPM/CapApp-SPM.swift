// CapApp-SPM ブリッジ
// プラグインモジュールを明示的に import することで、SPM のデッドストリッピングを回避し
// @objc クラスがランタイムに正しく登録されるようにする (特に HealthKit プラグイン)

import CapacitorHealthkitPlugin

public let isCapacitorApp = true

// プラグインクラスへの明示参照 (dead-stripping 防止)
@inline(never)
public func _forceLinkPlugins() {
    _ = CapacitorHealthkitPlugin.self
}
