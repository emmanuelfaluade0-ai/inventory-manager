const express = require('express');
const productsRouter = require('./routes/products');

const app = express();
app.use(express.json());

app.use('/api/products', productsRouter);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: { message: 'Invalid JSON body' } });
  }
  console.error(err);
  res.status(500).json({ error: { message: 'Internal server error' } });
});

if (require.main === module) {
  const port = process.env.PORT || 3001;
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

module.exports = app;
