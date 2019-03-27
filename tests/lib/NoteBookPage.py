import time

from BasePage import BasePage
from BasePage import InvalidPageException

from selenium.common.exceptions import NoSuchElementException

from selenium import webdriver
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.keys import Keys

class NoteBookPage(BasePage):

    _wait_timeout = 10
    _nb_tab_locator = "//li[@class='p-TabBar-tab jp-mod-current p-mod-closable p-mod-current']//div[@class='p-TabBar-tabIcon jp-NotebookIcon']"
    _nb_code_area_locator = "//div[@class='CodeMirror-code' and @role='presentation']//pre[@class=' CodeMirror-line ']//span[@role='presentation']//span[@cm-text='']"
    
    def __init__(self, driver, server=None):
        super(NoteBookPage, self).__init__(driver, server)

    def _validate_page(self):
        print("...NoteBookPage.validatePage()")

    def close(self):
        print("...closing a note book if there is any...")
        nb_locator = "//div[@class='p-TabBar-tabIcon jp-NotebookIcon']"
        try:
            nb = self.driver.find_element_by_xpath(nb_locator)
            print("FOUND a notebook")
            #if nb.is_displayed():
            #    print("notebooks is displayed!")
        except NoSuchElementException:
            print("NOT FINDING a notebook")
            return

        nb_divs = "//li[contains(@class, 'p-TabBar-tab')][contains(@title, 'Name: Untitled')]//div[starts-with(@class, 'p-TabBar')]"
        #print("nb_divs:{n}".format(n=nb_divs))
        try:
            elems = self.driver.find_elements_by_xpath(nb_divs)
            #print("FOUND elems")
            for e in elems:
                #print("FOUND e")
                attr = e.get_attribute("class")
                #print(attr)
                #if e.is_displayed():
                #    print("...displayed")
                #if e.is_enabled():
                #    print("...enabled")
                if e.is_displayed() and e.is_enabled() and attr == 'p-TabBar-tabCloseIcon':
                    print("...click on note book close icon..., attr: {a}".format(a=attr))
                    action_chains = ActionChains(self.driver)
                    action_chains.move_to_element(e)
                    action_chains.click(e).perform()
                    time.sleep(self._delay)

        except NoSuchElementException as e:
            print("Not finding divs")
            print("No notebook")

        # check if we are getting "Close without saving?" pop up
        close_without_saving_ok_locator = "//button[@class='jp-Dialog-button jp-mod-accept jp-mod-warn jp-mod-styled']//div[contains(text(), 'OK')]"
        try:
            ok_element = self.driver.find_elements_by_xpath(close_without_saving_ok_locator)
            print("FOUND 'Close without saving?' pop up")
            ok_element.click()
        except NoSuchElementException as e:
            print("No 'Close without saving?' pop up")

    def load_page(self, server, expected_element=(By.TAG_NAME, 'html'), 
                  timeout=_wait_timeout):
        print("...NoteBookPage.load_page()...do nothing")

    def enter_code(self, code_text):

        code_area_element = self.driver.find_element_by_xpath(self._nb_code_area_locator)

        ActionChains(self.driver).click(code_area_element).perform()
        a = ActionChains(self.driver)
        a.send_keys(code_text).key_down(Keys.SHIFT).send_keys(Keys.ENTER).key_up(Keys.SHIFT)
        a.perform()
        time.sleep(self._delay)

        print("xxx after entering: {c}".format(c=code_text))
