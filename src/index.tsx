// Dependencies
import {
  ABCWidgetFactory,
  DocumentRegistry,
  DocumentWidget,
  IDocumentWidget
} from "@jupyterlab/docregistry";

import { INotebookTracker, NotebookTracker } from "@jupyterlab/notebook";

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from "@jupyterlab/application";

import { IMainMenu, MainMenu } from "@jupyterlab/mainmenu";

// Project Components
import "../style/css/index.css";
import { EXTENSIONS } from "./constants";
import NCViewerWidget from "./NCViewerWidget";
import NotebookUtilities from "./NotebookUtilities";
import LeftSideBarWidget from "./LeftSideBarWidget";
import Utilities from "./Utilities";

const FILETYPE = "NetCDF";
const FACTORY_NAME = "vcdat";

// Declare the widget variables
let sidebar: LeftSideBarWidget; // The sidebar widget of the app
let shell: JupyterFrontEnd.IShell;
let mainMenu: MainMenu;

/**
 * Initialization data for the jupyter-vcdat extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  activate,
  autoStart: true,
  id: "jupyter-vcdat",
  requires: [INotebookTracker, IMainMenu]
};

export default extension;

/**
 * Activate the vcs widget extension.
 */
function activate(
  app: JupyterFrontEnd,
  tracker: NotebookTracker,
  menu: MainMenu
): void {
  shell = app.shell;
  mainMenu = menu;

  const factory = new NCViewerFactory({
    defaultFor: [FILETYPE],
    fileTypes: [FILETYPE],
    name: FACTORY_NAME,
    readOnly: true
  });

  const ft: DocumentRegistry.IFileType = {
    contentType: "file",
    extensions: EXTENSIONS,
    fileFormat: "base64",
    mimeTypes: ["application/netcdf"],
    name: FILETYPE
  };

  app.docRegistry.addFileType(ft);
  app.docRegistry.addWidgetFactory(factory);

  // Creates the left side bar widget once the app has fully started
  app.started
    .then(() => {
      sidebar = new LeftSideBarWidget(app, tracker);
      sidebar.id = /*@tag<left-side-bar>*/ "left-side-bar-vcdat";
      sidebar.title.iconClass = "jp-SideBar-tabIcon jp-icon-vcdat";
      sidebar.title.closable = true;

      // Attach it to the left side of main area
      shell.add(sidebar, "left");

      // Activate the widget
      shell.activateById(sidebar.id);
    })
    .catch(error => {
      console.error(error);
    });

  // Initializes the sidebar widget once the application shell has been restored
  // and all the widgets have been added to the notebooktracker
  app.restored
    .then(() => {
      Utilities.addHelpReference(
        mainMenu,
        "VCS Reference",
        "https://cdat-vcs.readthedocs.io/en/latest/"
      );
      Utilities.addHelpReference(
        mainMenu,
        "CDMS Reference",
        "https://cdms.readthedocs.io/en/latest/"
      );
      sidebar.initialize();
    })
    .catch(error => {
      console.error(error);
    });
}

/**
 * Create a new widget given a context.
 */
export class NCViewerFactory extends ABCWidgetFactory<
  IDocumentWidget<NCViewerWidget>
> {
  protected createNewWidget(
    context: DocumentRegistry.Context
  ): IDocumentWidget<NCViewerWidget> {
    const content = new NCViewerWidget(context);
    const ncWidget = new DocumentWidget({ content, context });

    if (sidebar === null || context === null) {
      return;
    }

    // Activate sidebar widget
    shell.activateById(sidebar.id);

    // Prepare the notebook for code injection
    sidebar.prepareNotebookPanel(context.session.path).catch(error => {
      if (error.status === "error") {
        NotebookUtilities.showMessage(error.ename, error.evalue);
      } else if (error.message) {
        NotebookUtilities.showMessage("Error", error.message);
      } else {
        NotebookUtilities.showMessage(
          "Error",
          "An error occurred when preparing the notebook."
        );
      }
    });

    return ncWidget;
  }
}
