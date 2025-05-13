import crypto from 'crypto';
import path from 'path';
import { readFile } from 'fs/promises';
import { genkit, z, Document } from 'genkit/beta';
import { logger } from 'genkit/logging';
import { 
    devLocalIndexerRef, 
    devLocalRetrieverRef,
    devLocalVectorstore
 } from '@genkit-ai/dev-local-vectorstore';
import { googleAI, gemini20Flash, gemini25FlashPreview0417 } from '@genkit-ai/googleai';
import { textEmbedding004, vertexAI } from '@genkit-ai/vertexai';
import { chunk } from 'llm-chunk';
import pdf from 'pdf-parse';

import dotenv from 'dotenv';
dotenv.config();

export const ai = genkit({
    plugins: [
        googleAI(), // automatically look for GOOGLE_API_KEY in your environment.
        vertexAI(),
        devLocalVectorstore([
            {
                indexName: 'linguistic',
                embedder: textEmbedding004,            
            }
        ])        
    ],
    promptDir: './llm_prompts',
    model: gemini25FlashPreview0417// gemini20Flash,
})

const chunkingConfig = {
    minLength: 1000,
    maxLength: 2000,
    splitter: 'sentence',
    overlap: 0,  // number of overlap chracters
    delimiters: '', // regex for base split method
};

const pdfIndexer = devLocalIndexerRef('linguistic')  
const devLocalRetriever = devLocalRetrieverRef('linguistic')

async function extractTextFromPdf(filePath) {
    try {
        const pdfFile = path.resolve(filePath);
        const dataBuffer = await readFile(pdfFile);
        const data = await pdf(dataBuffer);
        return data.text;
    } catch (error) {
        logger.error('Error extracting text from PDF:', error);
        throw error;
    }
}

const getHash = (text) => {
    return crypto.createHash('sha256').update(text).digest('hex');
}

const pdfRetriever =  ai.defineRetriever(
    {
        name: 'custom/pdfRetriever',
    },
    async (input) => {

    }
)

export const IndexFlow = ai.defineFlow({
        name: "indexFlow",
        inputSchema: z.string().describe("PDF file path"),
    }, async (filePath) => {
                
        // Read the pdf.
        const pdfTxt = await ai.run('extract-text', () =>
            extractTextFromPdf(filePath)
        );

        // Divide the pdf text into segments.
        const chunks = await ai.run('chunk-it', async () =>
            chunk(pdfTxt, chunkingConfig)
        );

        // Convert chunks of text into documents to store in the index.
        const documents = chunks.map((text) => {
            return Document.fromText(text, 
                { 
                    id: getHash(text),
                    filePath 
                });
        });
        
        // Actually generate embedding of each document 
        // and store this embedding (along with doc's metadata) into 'devLocalVestorStore'
        await ai.index({
            indexer: pdfIndexer, // devLocalIndexerRef('localIndexerRef'),
            documents
        });        
    }
)

export const SearchFlow = ai.defineFlow(
    {
        name: "SearchFlow",
        inputSchema: z.string(),     
    },
    async (input) => {
        const docs = await ai.retrieve({
            retriever: devLocalRetriever, //pdfRetriever,
            query: input,
            options: {
                k: 3,
                preRerankK: 10,
                customFilter: "words count > 5",
            }
        })
        
        const context = docs.slice(0,3)
        .map( (d) => 
        {
            console.log(d.content[0])
            return d.content[0]
        })
        .join("\n")

        const finalPrompt = `Answer the question using this context:\n${context}\nQuestion: ${input}`
        return { context, finalPrompt }
    }
)
