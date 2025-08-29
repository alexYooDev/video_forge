class ApiResponse {
    static success(data, message= 'Success') {
        return {
            success: true,
            data,
            message
        }
    }

    static error(message, errors = null) {
        return {
            success: false,
            message,
            ...(errors && {errors})
        }
    }

    static paginated(data, pagination) {
        return {
            success: true,
            data,
            pagination: {
                page: parseInt(pagination.page),
                limit: parseInt(pagination.limit),
                total: pagination.total,
                totalPages: Math.ceil(pagination.total / pagination.limit)
            }
        }
    }
}

module.exports = ApiResponse;