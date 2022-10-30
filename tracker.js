import express from 'express';
const app = express();

const db = {
    'lorem': {
        peers: ['ws://localhost:3001']
    }
}

app.get('/:file', (req, res) => {
    return res.json(db[req.params.file]);
})

const PORT = 5001;
app.listen(PORT, () => {
    console.log(`listening on PORT ${PORT}`);
})