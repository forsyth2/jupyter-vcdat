from MainPage import MainPage
from selenium.common.exceptions import NoSuchElementException


class SidecarPage(MainPage):
    def __init__(self, driver, server=None):
        super(SidecarPage, self).__init__(driver, server)

    def _validate_page(self):
        print("...SidecarPage.validatePage()")
        sidecar_title_locator = "//li[contains(@class, 'p-mod-current')]"
        sidecar_title_element = self.find_element_by_xpath(sidecar_title_locator,
                                                           'sidecar title')

        div = sidecar_title_element.find_element_by_xpath("./div[@class='p-TabBar-tabLabel']")
        # print("...sidecar_title: ", div.text)
        # For some reason the text is not printed

    def validate_image_is_displayed(self):
        print("...SidecarPage.validate_image_is_displayed...")
        output_areas_locator = "//div[contains(@class, 'jp-OutputArea')][contains(@class, 'p-StackedPanel-child')]"
        sidecar_output_areas = self.find_elements_by_xpath(output_areas_locator,
                                                           "sidecar output area")
        for a in sidecar_output_areas:
            class_attr = a.get_attribute("class")
            if "p-mod-hidden" in class_attr:
                # we can get here only if there are more than one sidecars
                # i.e. we do plots from more than one notebooks
                print("...found sidecar output area but hidden...skip...")
            else:
                print("...FOUND sidecar output area...")
                self.locate_image(a)
