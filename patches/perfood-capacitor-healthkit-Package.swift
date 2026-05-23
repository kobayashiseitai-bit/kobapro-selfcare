// swift-tools-version: 5.9
// このファイルは Capacitor 8 SPM 対応のため手動追加されたものです。
// patches/ に複製済み (postinstall で復元)
//
// 注意: ObjC マクロ (CAP_PLUGIN) ベースのプラグインを Swift Package に変換するため、
// .h / .m ファイルは exclude して、Swift 側で CAPBridgedPlugin プロトコルで登録する。
import PackageDescription

let package = Package(
    name: "PerfoodCapacitorHealthkit",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "PerfoodCapacitorHealthkit",
            targets: ["CapacitorHealthkitPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "CapacitorHealthkitPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Plugin",
            exclude: [
                "Info.plist",
                "CapacitorHealthkitPlugin.h",
                "CapacitorHealthkitPlugin.m"
            ]
        )
    ]
)
