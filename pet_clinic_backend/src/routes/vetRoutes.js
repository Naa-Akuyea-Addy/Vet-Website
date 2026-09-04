const router = require('express').Router();
const controller = require('../controllers/vetController');

// Public endpoint to list vets (optionally filter by service)
router.get('/', controller.list);

module.exports = router;
