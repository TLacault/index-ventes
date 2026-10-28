// One persistent Chrome profile for every site that needs a login. Log in once with `pnpm login`; the cookies stay in .profile/.
import { chromium } from 'playwright-core'

export const LOGIN_PAGES = [
  'https://www.collectorsquare.com/connexion',
  'https://www.sothebys.com/en/',
]

export const openBrowser = (headless = true) =>
  chromium.launchPersistentContext('.profile', {
    channel: 'chrome',
    headless,
    viewport: { width: 1400, height: 900 },
    locale: 'fr-FR',
  })
