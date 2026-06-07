import SwiftUI
#if os(iOS)
import UIKit
#endif

// The Oversight companion app. It pairs this device with the parent account by
// installing the Oversight configuration profile (web content filter + Safe
// DNS). The profile is what actually enforces filtering; this app makes
// installing it one tap and is the foundation for a future Network Extension
// that adds native, app-level enforcement (see apple/README.md).
struct ContentView: View {
    @AppStorage("serverURL") private var server = "https://oversight.netlify.app"
    @State private var code = ""

    private var brand: Color { Color(red: 0.31, green: 0.36, blue: 0.84) }

    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: "eye.fill")
                .font(.system(size: 44))
                .foregroundColor(brand)
                .padding(.top, 8)
            Text("Oversight")
                .font(.system(size: 32, weight: .bold))
            Text("Install family-safe filtering on this device.")
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            VStack(alignment: .leading, spacing: 6) {
                Text("Server URL").font(.caption).foregroundColor(.secondary)
                TextField("https://your-site.netlify.app", text: $server)
                    .textFieldStyle(.roundedBorder)
                    .disableAutocorrection(true)
            }
            VStack(alignment: .leading, spacing: 6) {
                Text("Setup code").font(.caption).foregroundColor(.secondary)
                TextField("8-character code", text: $code)
                    .textFieldStyle(.roundedBorder)
                    .disableAutocorrection(true)
                    #if os(iOS)
                    .textInputAutocapitalization(.characters)
                    #endif
            }

            Button(action: install) {
                Text("Install protection")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(brand)
            .disabled(code.trimmingCharacters(in: .whitespaces).count < 6)

            Spacer(minLength: 0)
            Text("Opens the Oversight setup page to install the configuration profile. On iPhone & iPad, removal is protected by the parent password.")
                .font(.footnote)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(28)
        .frame(maxWidth: 480, minHeight: 480)
    }

    private func install() {
        var base = server.trimmingCharacters(in: .whitespaces)
        if base.hasSuffix("/") { base.removeLast() }
        let trimmed = code.trimmingCharacters(in: .whitespaces)
        #if os(macOS)
        let platform = "macos"
        #else
        let platform = "ios"
        #endif
        guard let url = URL(string: "\(base)/api/profile?code=\(trimmed)&platform=\(platform)&name=This%20device") else { return }
        #if os(macOS)
        NSWorkspace.shared.open(url)
        #else
        UIApplication.shared.open(url)
        #endif
    }
}

#Preview {
    ContentView()
}
