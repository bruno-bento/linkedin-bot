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
    let currentPage = 1;

    while (hasMorePages) {
        const jobCards = await page.$$('li.jobs-search-results__list-item');

        for (let jobCard of jobCards) {
            await jobCard.click();
            await page.waitForSelector('.job-details-jobs-unified-top-card__job-title', { timeout: 5000 }); // Wait for job details to be visible
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

            //if (!jobData.some(job => job.company === company && job.title === title)) {
            jobData.push({ title, company, location, description });
            //}
        }
        const paginationButtons = await page.$$('ul.artdeco-pagination__pages li button');
        if (currentPage < paginationButtons.length) {
            await Promise.all([
                page.waitForResponse(response => response.url().includes('/jobs/') && response.status() === 200), // Wait for a network response indicating the next page has loaded
                paginationButtons[currentPage].click()
            ]);
            await page.waitForSelector('li.jobs-search-results__list-item'); // Ensure job cards are visible on the new page
            currentPage++;
        } else {
            hasMorePages = false;
        }
    }

    await browser.close();
    console.log(jobData.length)
    fs.writeFileSync('jobs.json', JSON.stringify(jobData, null, 2));

    console.log('Job data saved to jobs.json');
}

const delay = (time) => new Promise(resolve => setTimeout(resolve, time));

scrapeLinkedInJobs();
