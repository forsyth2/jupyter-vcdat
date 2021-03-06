import os
import sys

this_dir = os.path.abspath(os.path.dirname(__file__))
sys.path.append(os.path.join(this_dir, '..', 'PageObjects'))

from JupyterUtils import JupyterUtils
from MainPage import MainPage
from NoteBookPage import NoteBookPage

import time
import unittest
import tempfile

from selenium import webdriver
from selenium.webdriver import DesiredCapabilities
from selenium.webdriver.firefox.firefox_profile import FirefoxProfile
from selenium.webdriver.firefox.firefox_binary import FirefoxBinary
from pyvirtualdisplay import Display


class BaseTestCase(unittest.TestCase):
    '''
    Following env variable should be set:
    BROWSER_MODE: '--foreground' or '--headless'
    BROWSER_TYPE: 'chrome' or 'firefox'
    BROWSER_DRIVER: full path to your browser driver (chromedriver or geckodriver)
    If running with firefox on Linux, should also set:
       BROWSER_BINARY: full path to your firefox binary
    '''
    _delay = 1
    _wait_timeout = 15

    def setUp(self):
        print("\n\n#########...{}...".format(self._testMethodName))
        self._download_dir = tempfile.mkdtemp()
        browser = os.getenv("BROWSER_TYPE", 'chrome')
        mode = os.getenv("BROWSER_MODE", '--headless')
        print("...browser: {b}".format(b=browser))
        print("...mode: {m}".format(m=mode))

        if mode == "--headless" and os.getenv("CIRCLECI"):
            print("...starting display since we are running in headless mode")
            display = Display(visible=0, size=(800, 600))
            display.start()

        if browser == 'chrome':
            self.setup_for_chrome(mode)
        elif browser == 'firefox':
            self.setup_for_firefox(mode)

        self.driver.implicitly_wait(self._wait_timeout)
        time.sleep(self._delay)

        utils = JupyterUtils()
        self.server = utils.get_server()
        self.main_page = MainPage(self.driver, self.server)

    def tearDown(self):
        print("...BaseTestCase.tearDown()...")
        self.main_page.shutdown_kernel()
        self.driver.quit()

    def setup_for_chrome(self, mode):
        chrome_options = webdriver.ChromeOptions()
        chrome_options.add_argument(mode)
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("window-size=1200x600")
        self.driver = webdriver.Chrome(executable_path=os.getenv("BROWSER_DRIVER", "/usr/local/bin/chromedriver"),
                                       chrome_options=chrome_options,
                                       service_args=['--verbose', '--log-path=/tmp/chromedriver.log'])
        self.driver.implicitly_wait(10)

    def setup_for_firefox(self, mode):
        firefox_profile = FirefoxProfile()
        firefox_profile.set_preference('dom.disable_open_during_load', False)
        firefox_capabilities = DesiredCapabilities().FIREFOX
        firefox_capabilities['marionette'] = True
        firefox_capabilities['moz:firefoxOptions'] = {'args': ['--headless']}

        firefox_binary = FirefoxBinary(os.getenv("BROWSER_BINARY", "/usr/bin/firefox"))
        geckodriver_loc = os.getenv("BROWSER_DRIVER", "/usr/local/bin/geckodriver")
        self.driver = webdriver.Firefox(firefox_profile=firefox_profile,
                                        firefox_binary=firefox_binary,
                                        executable_path=geckodriver_loc,
                                        capabilities=firefox_capabilities)
        self.driver.implicitly_wait(10)

    #
    # Test Util functions
    #
    def new_notebook(self, launcher, notebook_name):
        notebook = NoteBookPage(self.driver, None)
        notebook.new_notebook(launcher, notebook_name)
        return notebook

    def save_close_notebook(self, notebook):
        '''
        save and close current notebook
        '''
        notebook.save_current_notebook()
        notebook.close_current_notebook()
