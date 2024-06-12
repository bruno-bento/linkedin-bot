const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async (numPaginas = 1) => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    await page.goto('https://www.linkedin.com/login');

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

    const jobs = [];
    let prevHeight = 0;

    const collectJobData = async () => {
        const newJobs = await page.evaluate(async () => {
            const jobCards = document.querySelectorAll('.job-card-container');
            const jobData = [];
    
            for (let job of jobCards) {
                job.click();
                await new Promise(resolve => setTimeout(resolve, 2000));
    
                const title = document.querySelector('.job-details-jobs-unified-top-card__job-title')?.innerText.trim();
                const company = document.querySelector('.job-details-jobs-unified-top-card__company-name')?.innerText.trim();
                const location = document.querySelector('.job-details-jobs-unified-top-card__job-insight')?.innerText.trim();
                const description = document.querySelector('.jobs-description--reformatted .jobs-description-content__text')?.innerText.trim();
    
                // Ensure job data is not duplicated by comparing the company
                if (!jobs.some(job => job.company === company)) {
                    jobData.push({ title, company, location, description });
                }
            }
    
            return jobData;
        });
    
        jobs.push(...newJobs);
    };

    while (true) {
        await collectJobData();

        const currentHeight = await page.evaluate(() => {
            const container = document.querySelector('.jobs-search-results-list');
            return container.scrollHeight;
        });
        console.log("currentHeight", currentHeight)
        console.log("prevHeight", prevHeight)
        if (currentHeight == prevHeight) {
            break; 
        }

        prevHeight = currentHeight;

        await page.evaluate(() => {
            const container = document.querySelector('.jobs-search-results-list');
            container.scrollBy(0, container.scrollHeight);
        });

        await delay(2000);
    }

    fs.writeFileSync('jobs.json', JSON.stringify(jobs, null, 2));

    const totalVagas = jobs.length;
    const vagasComRemuneracao = jobs.filter(job => job.description && /[\d\.\,]+/.test(job.description)).length;
    const remuneracoes = jobs.map(job => {
        if (job.description) {
            const match = job.description.match(/[\d\.\,]+/);
            return match ? parseFloat(match[0].replace(',', '.')) : null;
        }
        return null;
    }).filter(value => value !== null);
    const mediaRemuneracao = remuneracoes.reduce((a, b) => a + b, 0) / remuneracoes.length;
    const homeOffice = jobs.filter(job => job.location && /home office|remoto/i.test(job.location)).length;
    const hibrido = jobs.filter(job => job.location && /híbrido/i.test(job.location)).length;
    const presencial = jobs.filter(job => job.location && !/home office|remoto|híbrido/i.test(job.location)).length;

    console.log(`Total de vagas analisadas: ${totalVagas}`);
    console.log(`Quantas com remuneração explícita: ${vagasComRemuneracao}`);
    console.log(`Valor médio da remuneração: ${mediaRemuneracao.toFixed(2)}`);
    console.log(`Quantas híbrido: ${hibrido}`);
    console.log(`Quantas home office: ${homeOffice}`);
    console.log(`Quantas presencial: ${presencial}`);

    await browser.close();
})();
