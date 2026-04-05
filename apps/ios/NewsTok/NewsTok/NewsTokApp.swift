import SwiftUI

@main
struct NewsTokApp: App {
    var body: some Scene {
        WindowGroup {
            NavigationStack {
                FeedView()
            }
            .tint(NewsTokTheme.Colors.accent)
        }
    }
}
