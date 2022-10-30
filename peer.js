import express from "express";
import http from 'http';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client'
import path from 'path';
import fs from "fs/promises";
import { createReadStream } from "fs";
import fetch from "node-fetch";

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

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

    // connect peers for downloading
    const peers_network = [];
    for(const peer of peers) {
        const socket = ioClient(peer);
        socket.on('bitfield', (peer_download) => {
            console.log(peer_download);
        })
        peers_network.push(socket);
    }

    // in interval check for file peice
    while(knowledge_base['to_download'].length) {
        for(const socket of peers_network) {
            socket.emit('bitfield');
        }
        await delay(1000);
    }

    io.on('connection', (socket) => {
        // Seed: look for knowledge base and send files that I have
        socket.on('bitfield', () => {
            socket.emit('bitfield', knowledge_base['downloaded']);
        });
    })
}

const PORT = process.env.PORT || 3000;
const DOWNLOAD_PATH = process.env.DOWNLOAD_PATH;
server.listen(PORT, async () => {
    console.log(`Listening on port ${PORT}`);
    // peer
    const promises = [];
    // promises.push(downloadTorrent('./example/peer'));
    promises.push(downloadTorrent(DOWNLOAD_PATH));
    await Promise.all(promises);
});
