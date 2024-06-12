const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async (numPaginas = 1) => {
    // Configuração do Puppeteer
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    // Login no LinkedIn

    await page.goto('https://www.linkedin.com/login');

    await page.setViewport({
        width: 900,
        height: 1000
    });
    await page.type('#username', process.env.LINKEDIN_EMAIL);
    await page.type('#password', process.env.LINKEDIN_PASSWORD);
    await page.click('[type="submit"]');

    // Esperar a página carregar
    await page.waitForNavigation();

    // Navegar para a seção de vagas
    await page.goto('https://www.linkedin.com/jobs/collections/recommended/');

    // Esperar a página carregar
    await delay(3000); // Aguardar um momento para o carregamento completo da página

    const jobs = [];
    let prevHeight = 0;

    // Função para coletar dados das vagas
    const collectJobData = async () => {
        const newJobs = await page.evaluate(async () => {
            const jobCards = document.querySelectorAll('.job-card-container');
            const jobData = [];

            for (const job of jobCards) {
                job.click();
                await new Promise(resolve => setTimeout(resolve, 200)); // Esperar um momento para o carregamento dos detalhes

                const title = document.querySelector('.job-details-jobs-unified-top-card__job-title')?.innerText.trim();
                const company = document.querySelector('.job-details-jobs-unified-top-card__company-name')?.innerText.trim();
                const location = document.querySelector('.job-details-jobs-unified-top-card__job-insight')?.innerText.trim();
                const description = document.querySelector('.jobs-description--reformatted .jobs-description-content__text')?.innerText.trim();

                jobData.push({ title, company, location, description });
            }

            return jobData;
        });

        jobs.push(...newJobs);
    };

    // Loop to keep scrolling and collecting jobs
    while (true) {
        await collectJobData();

        const currentHeight = await page.evaluate(() => {
            const container = document.querySelector('.jobs-search-results-list');
            return container.scrollHeight;
        });
        console.log("currentHeight", currentHeight)
        console.log("prevHeight", prevHeight)
        if (currentHeight == prevHeight) {
            break; // No more jobs to load
        }

        prevHeight = currentHeight;

        await page.evaluate(() => {
            const container = document.querySelector('.jobs-search-results-list');
            container.scrollBy(0, container.scrollHeight);
        });

        await delay(3000); // Aguardar o carregamento das vagas adicionais
    }

    // Salvar dados em arquivo JSON
    fs.writeFileSync('jobs.json', JSON.stringify(jobs, null, 2));

    // Análise dos dados
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

    // Exibir resultados
    console.log(`Total de vagas analisadas: ${totalVagas}`);
    console.log(`Quantas com remuneração explícita: ${vagasComRemuneracao}`);
    console.log(`Valor médio da remuneração: ${mediaRemuneracao.toFixed(2)}`);
    console.log(`Quantas híbrido: ${hibrido}`);
    console.log(`Quantas home office: ${homeOffice}`);
    console.log(`Quantas presencial: ${presencial}`);

    // Fechar o navegador
    await browser.close();
})();
