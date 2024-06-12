const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

async function scrapeLinkedInJobs() {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle2', timeout: 60000 });

    await page.setViewport({
        width: 900,
        height: 1000
    });
    await page.type('#username', process.env.LINKEDIN_EMAIL);
    await page.type('#password', process.env.LINKEDIN_PASSWORD);
    await page.click('[type="submit"]');

    await page.waitForNavigation();

    await page.goto('https://www.linkedin.com/jobs/collections/recommended/');
    await delay(3000); 

    const jobData = [];
    let hasMorePages = true;

    while (hasMorePages) {
        const jobCards = await page.$$('.job-card-container');

        for (let jobCard of jobCards) {
            await jobCard.click();
            await page.waitForTimeout(2000);

            const title = await page.evaluate(() => {
                return document.querySelector('.job-details-jobs-unified-top-card__job-title')?.innerText.trim();
            });

            const company = await page.evaluate(() => {
                return document.querySelector('.job-details-jobs-unified-top-card__company-name')?.innerText.trim();
            });

            const location = await page.evaluate(() => {
                return document.querySelector('.job-details-jobs-unified-top-card__job-insight')?.innerText.trim();
            });

            const description = await page.evaluate(() => {
                return document.querySelector('.jobs-description--reformatted .jobs-description-content__text')?.innerText.trim();
            });

            if (!jobData.some(job => job.company === company && job.title === title)) {
                jobData.push({ title, company, location, description });
            }
        }

        hasMorePages = await page.evaluate(() => {
            const nextPageButton = document.querySelector('.artdeco-pagination__button--next');
            if (nextPageButton && !nextPageButton.disabled) {
                nextPageButton.click();
                return true;
            }
            return false;
        });

        if (hasMorePages) {
            await page.waitForTimeout(3000);
        }
    }

    await browser.close();

    fs.writeFileSync('jobs.json', JSON.stringify(jobData, null, 2));

    console.log('Job data saved to jobs.json');
}

const delay = (time) => new Promise(resolve => setTimeout(resolve, time));

scrapeLinkedInJobs();
