
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path'
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { ai } from './genkit.js';
import { logger } from 'genkit/logging';
// import { googleAI } from '@genkit-ai/googleai';

import dotenv from 'dotenv';
dotenv.config();

logger.setLogLevel('debug');
logger.debug("Genkit started");

const app = express();

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());
app.use(cors());

app.use(session({
    resave: false,
    saveUninitialized: true,
    secret: 'secret',
    cookie: { secure: false }
}))

// Serve index.html at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

app.post('/init', (req, res) => {
    logger.debug('Session before /init:', req.sessionID, req.session);

    const data = req.body;
    logger.debug('Received JSON in /init:', data);

    const prompt = data.prompt;
    req.session.prompt = prompt;
    logger.debug(req.session.prompt);
    
    res.status(200).json({ message: 'Prompt received' })
})

app.get('/chat_events', async (req, res) => {

    if( !req.session || !req.session.prompt ) {
        logger.warn(`SSE request from session (${req.sessionID}) without a prompt.`);

        res.flushHeaders(); // Send headers before writing event
        res.write('event: error\ndata: {"message": "Chat not initialized. Please set a prompt first via /init."}\n\n');
        res.end();

        return;
    }
    logger.info(`Prompt received from session: ${req.session.prompt}`);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // send headers

    res.write(`data: My answer: XXX\n\n`);

    try {
            // const sendEvent = (data) => {
            //     res.write(`data: ${JSON.stringify(data)}\n\n`);
            // };

            // // Send a message every 1 seconds
            // const intervalId = setInterval(() => {
            //     const timestamp = new Date().toISOString();
            //     logger.debug(`Server time: ${timestamp}`);
            //     sendEvent({ message: `Server time: ${timestamp}` });
            // }, 1000);
            
            const { response, stream } = ai.generateStream({
                prompt: req.session.prompt
            });
      
            for await (const chunk of stream) {
                const textContent = chunk.text || '';
                logger.debug(textContent);

                const timestamp = new Date().toISOString();
                logger.debug(`Server time: ${timestamp}`);

                res.write(`data: ${textContent}\n\n`);
            }

            // console.log((await response).text);

            req.on('close', () => {
                clearInterval(intervalId);
                res.end();
            })            

        } catch (error) {
            logger.error(error)
        }


})

const PORT = process.env.PORT || 8089;
app.listen(PORT, () => logger.info(`Server listening on http://localhost:${PORT}`) )