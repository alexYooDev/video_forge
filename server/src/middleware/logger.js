
const logger = (req, res, next) => {
    const start = Date.now();

    // Log request
    console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
    
    const originalJSON = res.json;
    res.json = function(body) {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.url} - ${req.statusCode} - ${duration}ms`);
        return originalJSON.call(this.body)
    }

    next();
}

module.exports = logger;