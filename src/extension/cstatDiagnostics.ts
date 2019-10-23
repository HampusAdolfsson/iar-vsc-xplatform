import * as vscode from "vscode"
import { Config } from "../iar/project/config";
import { CStat } from "../iar/tools/cstat";
import { Workbench } from "../iar/tools/workbench";
import { Project } from "../iar/project/project";
import { ListInputModel } from "./model/model";
import { PathLike } from "fs";
import { OsUtils } from "../utils/utils";

/**
 * Interacts with C-STAT to generate/clear C-STAT warnings, and displays the
 * warnings in VS Code.
 */
export class CStatDiagnosticsManager {
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor(private workbenchModel: ListInputModel<Workbench>,
                private projectModel: ListInputModel<Project>,
                private configurationModel: ListInputModel<Config>,
                private extensionPath: PathLike,) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection("C-STAT");
    }

    /**
     * Runs C-STAT on the current project and updates the warnings displayed in VS Code
     */
    generateDiagnostics() {
        if (OsUtils.detectOsType() !== OsUtils.OsType.Windows) {
            vscode.window.showErrorMessage("C-STAT is only available on windows, sorry!");
            return;
        }
        if (!this.workbenchModel.selected) {
            vscode.window.showWarningMessage("You must select a workbench before you can use C-STAT");
            return;
        }
        if (!this.projectModel.selected) {
            vscode.window.showWarningMessage("You must select a project before you can use C-STAT");
            return;
        }
        if (!this.configurationModel.selected) {
            vscode.window.showWarningMessage("You must select a configuration before you can use C-STAT");
            return;
        }

        const projectPath = this.projectModel.selected.path;
        const configName = this.configurationModel.selected.name;
        const analysis = CStat.runAnalysis(this.workbenchModel.selected.path, projectPath, configName);

        analysis.then(() => {
            CStat.getAllWarnings(projectPath, configName, this.extensionPath).then(warnings => {
                this.diagnosticCollection.clear();
                const filterString = vscode.workspace.getConfiguration("iarvsc").get<string>("cstatFilterLevel");
                const filterLevel = filterString ? 
                                        CStat.SeverityStringToSeverityEnum(filterString)
                                        : CStat.CStatWarningSeverity.LOW;
                warnings = warnings.filter(w => w.severity >= filterLevel);

                let fileDiagnostics: [vscode.Uri, vscode.Diagnostic[]][] = [];
                warnings.forEach(warning => {
                    const diagnostic = CStatDiagnosticsManager.warningToDiagnostic(warning);
                    fileDiagnostics.push([vscode.Uri.file(warning.file), [diagnostic]]);
                });

                this.diagnosticCollection.set(fileDiagnostics);

            });
        })
    }

    /**
     * Clears all C-STAT warnings
     */
    clearDiagnostics() {
        this.diagnosticCollection.clear();
    }

    private static warningToDiagnostic(warning: CStat.CStatWarning): vscode.Diagnostic {
        // VS Code uses zero-based lines/cols, C-STAT is one-based, so we need to correct for this.
        // Also, C-STAT seems to use (0,0) for msgs without a position, so we need to make sure
        // not to put these at (-1,-1) in VS Code (it doesn't like that).
        if (warning.line == 0) warning.line = 1;
        if (warning.col == 0) warning.col = 1;
        const pos = new vscode.Position(warning.line - 1, warning.col - 1);
        const range = new vscode.Range(pos, pos);

        let severity = vscode.DiagnosticSeverity.Warning;
        if (vscode.workspace.getConfiguration("iarvsc").get<boolean>("cstatDisplayLowSeverityWarningsAsHints")) {
            if (warning.severity == CStat.CStatWarningSeverity.LOW) severity = vscode.DiagnosticSeverity.Hint;
        }

        const diagnostic = new vscode.Diagnostic(range, warning.message, severity);
        diagnostic.source = warning.checkId;
        return diagnostic;
    }
}

export namespace Command {
    export function registerCommands(context: vscode.ExtensionContext, cstatDiagnostics: CStatDiagnosticsManager) {
        context.subscriptions.push(vscode.commands.registerCommand("iar.runCStat", () => {
            cstatDiagnostics.generateDiagnostics();
        }));
        context.subscriptions.push(vscode.commands.registerCommand("iar.clearCStat", () => {
            cstatDiagnostics.clearDiagnostics();
        }));
    }
}