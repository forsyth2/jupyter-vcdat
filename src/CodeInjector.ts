// Dependencies
import { NotebookPanel } from "@jupyterlab/notebook";
import { CommandRegistry } from "@phosphor/commands";

// Project Components
import { CellUtilities } from "./CellUtilities";
import AxisInfo from "./components/AxisInfo";
import Variable from "./components/Variable";
import {
  CANVAS_CELL_KEY,
  CHECK_MODULES_CMD,
  DATA_LIST_KEY,
  EXTENSIONS_REGEX,
  IMPORT_CELL_KEY,
  READER_CELL_KEY,
  REQUIRED_MODULES
} from "./constants";
import { NotebookUtilities } from "./NotebookUtilities";
import { MiscUtilities } from "./Utilities";

// Specifies valid plot export formats
export type ExportFormats = "png" | "pdf" | "svg" | "ps" | "";
export type ImageUnits = "pixels" | "in" | "cm" | "mm" | "dot";

/**
 * A class that manages the code injection of vCDAT commands
 */
export class CodeInjector {
  private _notebookPanel: NotebookPanel;
  private _commandRegistry: CommandRegistry;
  private _logErrorsToConsole: boolean; // Whether errors should log to console. Should be false during production.
  private _dataReaderList: { [dataName: string]: string }; // A dictionary containing data variable names and associated file path

  constructor(commands: CommandRegistry) {
    this._notebookPanel = null;
    this._commandRegistry = commands;
    this._logErrorsToConsole = true;
    this._dataReaderList = {};
    this._inject = this._inject.bind(this);
    this._addFileCmd = this._addFileCmd.bind(this);
    this._buildImportCommand = this._buildImportCommand.bind(this);
    this.injectImportsCode = this.injectImportsCode.bind(this);
    this.injectDataReaders = this.injectDataReaders.bind(this);
    this.injectCanvasCode = this.injectCanvasCode.bind(this);
    this.exportPlot = this.exportPlot.bind(this);
    this.createCopyOfGM = this.createCopyOfGM.bind(this);
    this.getGraphicMethod = this.getGraphicMethod.bind(this);
    this.getTemplate = this.getTemplate.bind(this);
    this.loadVariable = this.loadVariable.bind(this);
    this.plot = this.plot.bind(this);
    this.clearPlot = this.clearPlot.bind(this);
    this.tryFilePath = this.tryFilePath.bind(this);
    this.getDataReaderName = this.getDataReaderName.bind(this);
  }

  get notebookPanel(): NotebookPanel {
    return this._notebookPanel;
  }

  set notebookPanel(notebookPanel: NotebookPanel) {
    this._notebookPanel = notebookPanel;
  }

  get dataReaderList(): { [dataName: string]: string } {
    return this._dataReaderList;
  }

  set dataReaderList(dataReaderList: { [dataName: string]: string }) {
    this._dataReaderList = dataReaderList;
  }

  /**
   * This will inject the required modules into the current notebook (if a module was not already imported)
   * @param index The index of where the imports cell should be. Default is -1, which will insert at the top.
   * @param skip Default false. If set to true, a check of the kernel will be made to see if the modules are already
   * imported and any that are will be skipped (not added) in the import statements of the required code.
   * @returns The index of where the cell was inserted
   */
  public async injectImportsCode(
    index: number = -1,
    skip: boolean = false
  ): Promise<number> {
    // Check if required modules are imported in notebook
    let cmd = "#These imports are added for vcdat.";

    if (skip) {
      // Check if necessary modules are loaded
      const output: string = await NotebookUtilities.sendSimpleKernelRequest(
        this.notebookPanel,
        CHECK_MODULES_CMD
      );

      // Create import string based on missing dependencies
      const missingModules: string[] = eval(output);
      if (missingModules.length > 0) {
        cmd += this._buildImportCommand(missingModules, false);
      } else {
        return index;
      }
    } else {
      cmd += this._buildImportCommand(eval(`[${REQUIRED_MODULES}]`), false);
    }

    // Find the index where the imports code is injected
    let cellIdx: number = CellUtilities.findCellWithMetaKey(
      this.notebookPanel,
      IMPORT_CELL_KEY
    )[0];

    if (cellIdx < 0) {
      const [newIdx]: [number, string] = await this._inject(
        cmd,
        index,
        "Error occured when adding imports.",
        "injectImportsCode",
        arguments
      );
      cellIdx = newIdx;
    } else {
      // Inject code into existing imports cell and run
      CellUtilities.injectCodeAtIndex(this.notebookPanel.content, cellIdx, cmd);
      await CellUtilities.runCellAtIndex(
        this._commandRegistry,
        this._notebookPanel,
        cellIdx
      );
    }

    // Set cell meta data to identify it as containing imports
    await CellUtilities.setCellMetaData(
      this.notebookPanel,
      cellIdx,
      IMPORT_CELL_KEY,
      "saved",
      true
    );

    return cellIdx;
  }

  /**
   * This will load data from a file so it can be used by vcdat
   * @param index The index to use for the cell containing the data variables
   * @param filePath The filepath of the new file to open
   */
  public async injectDataReaders(
    index: number,
    filePath: string
  ): Promise<number> {
    // If the data file doesn't have correct extension, exit
    if (filePath == "") {
      throw new Error("The file path was empty.");
    }

    // If the data file doesn't have correct extension, exit
    if (!EXTENSIONS_REGEX.test(filePath)) {
      throw new Error("The file has the wrong extension type.");
    }

    // Get the relative path of the file for the injection command
    const nbPath: string = `${this.notebookPanel.session.path}`;
    const newFilePath: string = MiscUtilities.getRelativePath(nbPath, filePath);

    // Try opening the file first, before injecting into code, exit if failed
    const isValidPath: boolean = await this.tryFilePath(newFilePath);
    if (!isValidPath) {
      throw new Error(`The file failed to open. Path: ${newFilePath}`);
    }

    // If file opened fine, find the index where the file data code is injected
    let cellIdx: number = CellUtilities.findCellWithMetaKey(
      this.notebookPanel,
      READER_CELL_KEY
    )[0];

    // Get list of data files to open
    const dataVarNames: string[] = Object.keys(this.dataReaderList);

    // Build command that opens any existing data file(s)
    let cmd: string;
    let tmpFilePath: string;
    const addCmds: Array<Promise<string>> = new Array<Promise<string>>();

    if (dataVarNames.length > 0) {
      cmd = "#Open the files for reading";
      dataVarNames.forEach((existingDataName: string, idx: number) => {
        tmpFilePath = this.dataReaderList[existingDataName];

        // Exit early if the filepath has already been opened
        if (tmpFilePath == filePath) {
          if (idx < 0) {
            return index;
          }
          return idx;
        }

        // Add file open command to the list
        addCmds.push(this._addFileCmd(tmpFilePath));
      });

      const allFiles: string[] = await Promise.all(addCmds);
      cmd += allFiles.join("");
    } else {
      cmd = `#Open the file for reading`;
    }

    const newName: string = this.getDataReaderName(filePath);
    const addCmd: string = `\n${newName} = cdms2.open('${newFilePath}')`;

    cmd += addCmd;

    if (cellIdx < 0) {
      // Insert a new cell with given command and run
      const [newIdx]: [number, string] = await this._inject(
        cmd,
        index,
        "Error occured when opening data readers.",
        "injectDataReaders",
        arguments
      );

      cellIdx = newIdx;
    } else {
      // Inject code into existing data variables cell and run
      CellUtilities.injectCodeAtIndex(this.notebookPanel.content, cellIdx, cmd);
      await CellUtilities.runCellAtIndex(
        this._commandRegistry,
        this.notebookPanel,
        index
      );
    }

    // Update or add the file path to the data readers list
    this.dataReaderList[newName] = filePath;

    // Set cell meta data to identify it as containing data variables
    await CellUtilities.setCellMetaData(
      this.notebookPanel,
      cellIdx,
      READER_CELL_KEY,
      "saved",
      true
    );

    // Update the metadata
    await NotebookUtilities.setMetaData(
      this.notebookPanel,
      DATA_LIST_KEY,
      this.dataReaderList
    );

    return cellIdx;
  }

  /**
   * Looks for a cell containing the canvas declarations and updates its code
   * to contain the specified number of canvases.
   * If no cell containing canvas code is found a whole new one is inserted.
   * @param index The index of the cell to replace or insert the canvas code
   */
  public async injectCanvasCode(index: number): Promise<number> {
    // Creates canvas(es)
    const cmd: string = `#Create canvas and sidecar\ncanvas = vcs.init()`;

    // Find the index where the canvas code is injected
    let cellIdx: number = CellUtilities.findCellWithMetaKey(
      this.notebookPanel,
      CANVAS_CELL_KEY
    )[0];

    if (cellIdx < 0) {
      // Inject the code for starting the canvases
      const [newIdx]: [number, string] = await this._inject(
        cmd,
        index,
        "Error occurred when injecting canvas code.",
        "injectCanvasCode",
        arguments
      );

      cellIdx = newIdx;
    } else {
      // Replace code in canvas cell and run
      CellUtilities.injectCodeAtIndex(this.notebookPanel.content, cellIdx, cmd);
      await CellUtilities.runCellAtIndex(
        this._commandRegistry,
        this.notebookPanel,
        cellIdx
      );
    }

    // Set cell meta data to identify it as containing canvases
    await CellUtilities.setCellMetaData(
      this.notebookPanel,
      cellIdx,
      CANVAS_CELL_KEY,
      "saved",
      true
    );

    return cellIdx;
  }

  /**
   * Injects code into the bottom cell of the notebook, doesn't display results (output or error)
   * @param code A string that has the code to inject into the notebook cell.
   * @returns Promise<[number, string]> - A promise for when the cell code has executed containing
   * the cell's index and output result
   */

  public async exportPlot(
    format: ExportFormats,
    name: string,
    width?: string,
    height?: string,
    units?: ImageUnits,
    provenance?: boolean
  ): Promise<void> {
    let cmd: string;

    // Set beginning of command based on type
    switch (format) {
      case "png":
        cmd = `canvas.png('${name}'`;
        break;
      case "pdf":
        cmd = `canvas.pdf('${name}'`;
        break;
      case "svg":
        cmd = `canvas.svg('${name}'`;
        break;
      case "ps":
        cmd = `canvas.postscript('${name}'`;
        break;
      default:
        cmd = `canvas.png('${name}'`;
    }

    // If width and height specified, add to command based on units
    if (width && height) {
      let w, h: number;
      if (units === "pixels" || units === "dot") {
        w = Number.parseInt(width);
        h = Number.parseInt(height);
      } else {
        w = Number.parseFloat(width);
        h = Number.parseFloat(height);
      }
      cmd += `, width=${w}, height=${h}, units='${units}'`;
      // Export of png plot can include provenance
      if (format === "png" && provenance !== undefined) {
        if (provenance) {
          cmd += `, provenance=True)`;
        } else {
          cmd += `, provenance=False)`;
        }
      } else {
        cmd += `)`;
      }
    }

    await this._inject(
      cmd,
      undefined,
      "Failed to export plot.",
      "exportPlot",
      arguments
    );
  }

  public async createCopyOfGM(
    newName: string,
    groupName: string,
    methodName: string
  ) {
    // Exit if any parameter is empty string
    if (!newName || !groupName || !methodName) {
      throw new Error("One of the input parameters was empty.");
    }

    // Create the code to copy the graphics method
    let cmd: string = `${newName}_${groupName} = `;
    cmd += `vcs.create${groupName}('${newName}',source='${methodName}')`;

    // Inject the code into the notebook cell
    await this._inject(
      cmd,
      undefined,
      "Failed to copy graphics method.",
      "createCopyOfGM",
      arguments
    );
  }

  public async getGraphicMethod(group: string, name: string) {
    let cmd: string = "";
    if (name.indexOf(group) < 0) {
      cmd = `${name}_${group} = vcs.get${group}('${name}')`;
    } else {
      cmd = `${name} = vcs.get${group}('${name}')`;
    }

    // Inject the code into the notebook cell
    await this._inject(
      cmd,
      undefined,
      "Failed to inject new graphic method.",
      "getGraphicMethod",
      arguments
    );
  }

  public async getTemplate(templateName: string) {
    const cmd: string = `${templateName} = vcs.gettemplate('${templateName}')`;

    // Inject the code into the notebook cell
    await this._inject(
      cmd,
      undefined,
      "Failed to inject new template.",
      "getTemplate",
      arguments
    );
  }

  public async loadVariable(variable: Variable) {
    // inject the code to load the variable into the notebook
    let cmd = `${variable.name} = ${variable.sourceName}("${variable.name}"`;
    variable.axisInfo.forEach((axis: AxisInfo) => {
      cmd += `, ${axis.name}=(${axis.min}, ${axis.max})`;
    });
    cmd += ")";

    // Inject the code into the notebook cell
    await this._inject(
      cmd,
      undefined,
      "Failed to load variable.",
      "loadVariable",
      arguments
    );
  }

  public async clearPlot() {
    await this._inject(
      "canvas.clear()",
      undefined,
      "Clearing canvas failed.",
      "clearPlot"
    );
  }

  public async plot(
    selectedVariables: string[],
    selectedGM: string,
    selectedGMGroup: string,
    selectedTemplate: string,
    overlayMode: boolean
  ) {
    // Create graphics method code
    if (!selectedGM) {
      if (selectedVariables.length > 1) {
        selectedGM = '"vector"';
      } else {
        selectedGM = '"boxfill"';
      }
    } else if (selectedGM.indexOf(selectedGMGroup) < 0) {
      selectedGM += `_${selectedGMGroup}`;
    }

    // Create template code
    if (!selectedTemplate) {
      selectedTemplate = '"default"';
    }

    // Create plot injection command string
    let cmd: string = "";
    if (overlayMode) {
      cmd = "canvas.plot(";
    } else {
      cmd = "canvas.clear()\ncanvas.plot(";
    }
    for (const varName of selectedVariables) {
      cmd += varName + ", ";
    }
    cmd += `${selectedTemplate}, ${selectedGM})`;

    await this._inject(
      cmd,
      undefined,
      "Failed to make plot.",
      "plot",
      arguments
    );
  }

  // Will try to open a file path in cdms2. Returns true if successful.
  public async tryFilePath(filePath: string) {
    try {
      await NotebookUtilities.sendSimpleKernelRequest(
        this.notebookPanel,
        `tryOpenFile = cdms2.open('${filePath}')\ntryOpenFile.close()`,
        false
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets the name for a data reader object to read data from a file. Creates a new name if one doesn't exist.
   * @param filePath The file path of the new file added
   */
  public getDataReaderName(filePath: string): string {
    // Check whether that file path is already open, return the data name if so
    let dataName: string = "";
    const found: boolean = Object.keys(this.dataReaderList).some(
      (dataVar: string) => {
        dataName = dataVar;
        return this.dataReaderList[dataVar] == filePath;
      }
    );
    if (found) {
      return dataName;
    }

    // Filepath hasn't been added before, create the name for data variable based on file path
    dataName = MiscUtilities.createValidVarName(filePath) + "_data";

    // If the reader name already exist but the path is different (like for two files with
    // similar names but different paths) add a count to the end until it's unique
    let count: number = 1;
    let newName: string = dataName;

    while (Object.keys(this.dataReaderList).indexOf(newName) >= 0) {
      newName = `${dataName}${count}`;
      count++;
    }

    return newName;
  }

  /**
   * This is the injection method used by the other code injector functions for injecting code into the notebook
   * @param code The code that will be injected
   * @param index The index of where the code should be injected (will be that last cell in notebook if undefined)
   * @param errorMsg The error message to provide if injection throws an error
   * @param funcName The name of the function calling the injection
   * @param funcArgs The arguments object of the calling function
   */
  private async _inject(
    code: string,
    index?: number,
    errorMsg?: string,
    funcName?: string,
    funcArgs?: IArguments
  ): Promise<[number, string]> {
    if (this.notebookPanel == null) {
      throw Error("No notebook, code injection cancelled.");
    }
    try {
      const idx: number =
        index | (this.notebookPanel.content.model.cells.length - 1);
      const [newIdx, result]: [
        number,
        string
      ] = await CellUtilities.insertRunShow(
        this.notebookPanel,
        this._commandRegistry,
        idx,
        code,
        true
      );
      this.notebookPanel.content.activeCellIndex = newIdx + 1;
      return [newIdx, result];
    } catch (error) {
      const detailError: InjectionError = new InjectionError(
        error,
        code,
        errorMsg,
        funcName,
        funcArgs
      );
      if (this._logErrorsToConsole) {
        console.log(detailError.getRawError());
      }
      NotebookUtilities.showMessage(
        "Command Error",
        detailError.getUserErrorMsg()
      );
    }
  }

  /**
   * This will construct an import string for the notebook based on the modules passed to it. It is used for imports injection.
   * @param modules An array of strings representing the modules to include in the import command.
   * @param lazy Whether to use lazy imports syntax when making the command. Will include lazy_imports
   * if it is needed.
   */
  private _buildImportCommand(modules: string[], lazy: boolean): string {
    let cmd: string = "";
    // Check for lazy_imports modules first
    const tmpModules = modules;
    const idx = modules.indexOf("lazy_import");

    if (lazy) {
      // Import lazy_imports if it's missing, before doing other imports
      if (idx >= 0) {
        tmpModules.splice(idx, 1);
        cmd = "\nimport lazy_import";
      }
      // Import other modules using lazy import syntax
      tmpModules.forEach(module => {
        cmd += `\n${module} = lazy_import.lazy_module("${module}")`;
      });
    } else {
      // Remove lazy_imports from required modules if it is there
      if (idx >= 0) {
        tmpModules.splice(idx, 1);
      }
      // Import modules
      tmpModules.forEach(module => {
        cmd += `\nimport ${module}`;
      });
    }
    return cmd;
  }

  // Add returns a line of code for adding the specified file to the notebook
  // If the file couldn't be opened, returns empty string
  private async _addFileCmd(filePath: string): Promise<string> {
    // Get the relative filepath to open the file
    const relativePath = MiscUtilities.getRelativePath(
      this.notebookPanel.session.path,
      filePath
    );
    // Check that file can open before adding it as code
    const valid: boolean = await this.tryFilePath(relativePath);
    if (valid) {
      const addCode: string = `\n${this.getDataReaderName(
        filePath
      )} = cdms2.open('${relativePath}')`;
      return addCode;
    }
    return "";
  }
}

/**
 * Provides more detail for code injection related errors. For use only within code injector class.
 */
class InjectionError {
  private _error: Error; // The original error thrown
  private _message: string; // A detailed message for the error
  constructor(
    error: Error, // The error that occurred
    code: string, // Injection code used in the function that caused error
    msg?: string, // Error message to use
    funcName?: string, // The name of the injection function
    args?: IArguments // The arguments passed to the injection function
  ) {
    const message = msg || "An error occurred.";
    const codeStr = code || "Not applicable.";
    let funcStr = funcName || "No function name provided.";
    if (args) {
      funcStr += `(${[...args]})`;
    } else {
      funcStr = "()";
    }
    this._message = `${message}\nFunction call: ${funcStr} \
    \nCode injected: ${codeStr}\nOriginal${error.stack}`;
    this._error = error;
  }
  // Returns the error object created by this class
  public getRawError(): Error {
    return new Error(this._message);
  }

  // Returns an error message for user display
  public getUserErrorMsg(): string {
    return `${this._error.message}`;
  }
}