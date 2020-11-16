
const RubyLanguageServer = require("./lsp");

var langserver = null;

exports.activate = function() {
    // Do work when the extension is activated
    langserver = new RubyLanguageServer();
}

exports.deactivate = function() {
    // Clean up state before the extension is deactivated
    if (langserver) {
        langserver.deactivate();
        langserver = null;
    }
}



