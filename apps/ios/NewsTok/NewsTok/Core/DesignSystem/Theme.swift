import SwiftUI

enum NewsTokTheme {
    enum Colors {
        static let background = Color(red: 0.96, green: 0.95, blue: 0.92)
        static let cardTop = Color(red: 0.16, green: 0.28, blue: 0.34)
        static let cardBottom = Color(red: 0.88, green: 0.46, blue: 0.29)
        static let accent = Color(red: 0.14, green: 0.39, blue: 0.52)
        static let primaryText = Color(red: 0.16, green: 0.15, blue: 0.13)
        static let secondaryText = Color(red: 0.31, green: 0.30, blue: 0.27)
    }

    enum Spacing {
        static let screenPadding: CGFloat = 20
    }

    enum CornerRadius {
        static let card: CGFloat = 30
    }
}
