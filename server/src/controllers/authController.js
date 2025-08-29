const authSchema = require('../models/authSchema.js');
const authService = require('../services/authService.js');

class AuthController {

    async register (req,res,next) {
        try {
            const {error, value} = authSchema.validate(req.body);
            if (error) {
                return res.status(400).json({message: 'Validation failed' + error.details});
            }
            const result = await authService.register(value.email, value.password);

            res.status(201).json({data: result, message: 'User registered successfully'});
        } catch (err) {
            next(err);
        }
    }

    async login (req, res, next) {

        try {
            const {error, value} = authSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    message: 'validation failed' + error.details
                });
            }

            const {email, password} = value;

            const result = await authService.login(email, password);

            res.status(200).json({data: result, message: 'Login successful'});
        } catch (err) {
            next(err);
        }
    }

    async logout(req, res) {
        res.status(200).json({data: null, message: 'Logout Successful'});
    }
}

module.exports = new AuthController();