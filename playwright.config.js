import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/e2e',timeout:120000,retries:0,workers:1,reporter:[['list'],['html',{open:'never'}]],
 use:{baseURL:'http://localhost:3000',browserName:'chromium',viewport:{width:1440,height:1000},trace:'retain-on-failure',screenshot:'only-on-failure'},
 webServer:{command:'npm run start',url:'http://localhost:3000',reuseExistingServer:!process.env.CI,timeout:120000}});
