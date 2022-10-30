import express from "express";
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from "fs/promises";
import { createReadStream } from "fs";
import fetch from "node-fetch";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

function getKnowledgeBase(file_details, downloadPath) {
    return new Promise((resolve, reject) => {
        const { name, length, pieces } = file_details;
        const knowledge_base = { downloaded: [], to_download: [] };
        const chunkSize = Math.ceil(length / pieces);
        try {
            const rs = createReadStream(path.join(downloadPath, name), {
                encoding: 'utf-8',
                autoClose: true,
                highWaterMark: chunkSize
            });
            let idx = 0;
    
            rs.on('data', (chunk) => {
                const isDownloadedChunk = chunk.toString().replace(/\0/g, '').length !== 0;
                if(isDownloadedChunk) knowledge_base['downloaded'].push(idx++);
                else knowledge_base['to_download'].push(idx++);

                if(idx === pieces) resolve(knowledge_base);
            })
    
            rs.on('error', (err) => {
                console.log(err);
            })
        } catch(err) {
            resolve(knowledge_base);
        }
    })
}

async function downloadTorrent(
    downloadPath,
    torrent_path = "Users/ravilamkoti/Desktop/Workplace/Learning/p2p-torrent-network/example/lorem.torrent"
) {
    // read torrent
    torrent_path = ["/", torrent_path].join("");
    const torrent_json = await fs.readFile(torrent_path, {
        encoding: "utf-8",
    });
    const torrent_detail = JSON.parse(torrent_json);
    const { tracker_server_location, file_details } = torrent_detail;

    // get peers details
    const peer_details = await fetch(tracker_server_location);
    const peer_details_json = await peer_details.json();
    const { peers } = peer_details_json;

    // make own knowledge base (what have and what require)
    const knowledge_base = await getKnowledgeBase(file_details, downloadPath);
    // seeding ( share what you have )
    // leech ( download what require )
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Listening on port ${PORT}`);
    // peer
    const promises = [];
    // promises.push(downloadTorrent('./example/peer'));
    promises.push(downloadTorrent('./example/client'));
    await Promise.all(promises);
});
