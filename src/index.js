
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path'
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { ai } from './genkit.js';
import { logger } from 'genkit/logging';

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

app.post('/init', async (req, res) => {
    logger.debug('Session before /init:', req.sessionID, req.session);

    const data = req.body;
    const question = data.question;

    const prompt = ai.prompt('tools_agent'); // '.prompt' extension will be added automatically
    const renderedPrompt = await prompt.render( { input: question } );

    req.session.prompt = renderedPrompt;
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

    try {
            const prompt = req.session.prompt;
            const { response, stream } = ai.generateStream({
                messages: prompt.messages,
                config: {
                    temperature: 0.8
                }                
            });
      
            for await (const chunk of stream) {
                const textContent = chunk.text || '';
                logger.debug(textContent);

                res.write(`data: ${textContent}\n\n`);
            }

            // console.log((await response).text);

            req.on('close', () => {
                res.end();
            })            

        } catch (error) {
            logger.error(error)
        }


})

const PORT = process.env.PORT || 8089;
app.listen(PORT, () => logger.info(`Server listening on http://localhost:${PORT}`) )