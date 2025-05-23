
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path'
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { ai, SearchFlow, IndexFlow } from './genkit.js';
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

    const prompt = ai.prompt('general_agent'); // '.prompt' extension will be added automatically
    const renderedPrompt = await prompt.render( { input: question } );

    req.session.prompt = renderedPrompt;
    req.session.query = question;
    logger.debug(`Prompt: ${JSON.stringify(req.session.prompt)}\n Query: ${req.session.query}`);
 
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
            const query = req.session.query;
            
            // Run SearchFlow - RAG step
            const finalPrompt = await SearchFlow(query);
            
            const { response, stream } = ai.generateStream({
                messages: prompt.messages,
                prompt: [
                    { text: finalPrompt }
                ],
                config: {
                    temperature: 0.8
                }                
            });
      
            for await (const chunk of stream) {
                const textContent = chunk.text || '';
                logger.debug(textContent);

                res.write(`event:message\ndata: ${textContent}\n\n`);
            }

            logger.debug((await response).text);

            req.on('close', () => {
                res.end();
            })            

        } catch (error) {
            logger.error(error)
        }
})

app.put('/index', async (req, res) => {

    const body = req.body;
    const path = body.path;
    if( !path )
        return res.status(400).json({ message: "Missing 'path' in request body."})
    await IndexFlow(path);

    res.status(200).send()
})

const PORT = process.env.PORT || 8089;
app.listen(PORT, () => logger.info(`Server listening on http://localhost:${PORT}`) )