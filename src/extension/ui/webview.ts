import * as vscode from 'vscode'
import { readFile } from 'fs';
import { join } from 'path';

// TODO: Give class and file a more descriptive name
/**
 * Shows and manages a web view instance. The web view content is defined by the
 * files the `webview` folder next to this file.
 */
export class IarWebView {
    private _htmlPath: string;
    private _panel: vscode.WebviewPanel | undefined;

    constructor(context: vscode.ExtensionContext) {
        this._htmlPath = join(context.extensionPath, 'src', 'extension', 'ui', 'webview', 'index.html');
    }

    /**
     * Opens a new webview or, if one already exists, brings it into view.
     */
    open() {
        if (!this._panel) {
            this._panel = vscode.window.createWebviewPanel('iarHome',
                                                            'IAR Home',
                                                            vscode.ViewColumn.One,
                                                            { enableScripts: true, enableFindWidget: false });
            readFile(this._htmlPath, (err, data) => {
                if (err) console.error(err);
                this._panel!!.webview.html = data.toString();
            });
        } else {
            this._panel.reveal();
        }
    }
}