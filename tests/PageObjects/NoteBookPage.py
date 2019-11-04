from MainPage import MainPage
from selenium.common.exceptions import NoSuchElementException


class NoteBookPage(MainPage):
    def __init__(self, driver, server=None):
        super(NoteBookPage, self).__init__(driver, server)

    def _validate_page(self):
        print("...NoteBookPage.validatePage()")
        # no op for now

    #
    # locators
    #
    def locate_last_notebook_cell(self):
        nb_cell_locator = "//div[@class='p-Widget jp-Cell jp-CodeCell jp-Notebook-cell']"
        
        nb_cells = self.find_elements_by_xpath(nb_cell_locator, "notebook cell")
        if len(nb_cells) == 0:
            print("No jp-Notebook cell found")
            raise NoSuchElementException

        print("INFO...number of nb_cells: {}".format(len(nb_cells)))
        notebook_cell = nb_cells[len(nb_cells) - 1]
        return notebook_cell

    def new_notebook(self, launcher_title, notebook_name):
        print("...NoteBookPage.new_notebook...")
        self.click_on_folder_tab()
        self.click_on_notebook_launcher(launcher_title)
        self.rename_notebook(notebook_name)
        self.notebook_name = notebook_name

    def get_notebook_name(self):
        return(self.notebook_name)

    def rename_notebook(self, new_name):
        self.click_on_top_menu_item("File")

        data_command = "docmanager:rename"
        self.click_on_submenu_with_data_command(data_command,
                                                "Rename Notebook")
        rename_notebook_input_locator = "//input[@class='jp-mod-styled']"
        input_area = self.find_element_by_xpath(rename_notebook_input_locator,
                                                "Rename Notebook input area")
        self.enter_text(input_area, new_name)

    def save_current_notebook(self):
        print("...save_current_notebook...")
        self.click_on_top_menu_item("File")
        data_command = "docmanager:save"
        try:
            self.click_on_submenu_with_data_command(data_command,
                                                    "Save Notebook")
        except NoSuchElementException:
            print("Nothing to save in the notebook")

    def close_current_notebook(self):
        print("...close_current_notebook...")
        self.click_on_top_menu_item("File")
        data_command = "filemenu:close-and-cleanup"
        self.click_on_submenu_with_data_command(data_command,
                                                "Close and Shutdown")
        # check if we are getting "Close without saving?" pop up
        close_without_saving_ok_locator = "//div[contains(text(), 'OK')]"
        try:
            ok_element = self.find_element_by_xpath(close_without_saving_ok_locator,
                                                    "Close Notebook 'OK' button")
            print("FOUND 'Close without saving?' pop up, click 'OK'")
            self.move_to_click(ok_element)
        except NoSuchElementException:
            print("No 'Close without saving?' pop up")

    def validate_image_is_displayed(self):
        '''
        validates that an image is displayed in the last cell.
        '''
        print("...NoteBookPage.validate_image_is_displayed...")
        nb_cell = self.locate_last_notebook_cell()
        self.locate_image(nb_cell)
            
