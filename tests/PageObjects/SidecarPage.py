from MainPage import MainPage
from selenium.common.exceptions import NoSuchElementException


class SidecarPage(MainPage):
    def __init__(self, driver, server=None):
        super(SidecarPage, self).__init__(driver, server)

    def _validate_page(self):
        print("...SidecarPage.validatePage()")
        # no op for now

    
