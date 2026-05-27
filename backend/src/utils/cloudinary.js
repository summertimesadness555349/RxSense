const {v2:cloudinary} = require('cloudinary');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadAvatarBuffer = (buffer, userId) => {
    return new Promise((resolve, reject) => {
        const folder = process.env.CLOUDINARY_FOLDER || 'avatars';
        const upload = cloudinary.uploader.upload_stream(
            {
                folder,
                public_id: `user_${userId}_${Date.now()}`,
                resource_type: 'image',
                overwrite: true,
                transformation: [
                    { width: 400, height: 400, crop: 'fill', gravity: 'face' },
                    { quality: 'auto', fetch_format: 'auto' }
                ]
            },
            (err, result) => {
                if (err) return reject(err);
                resolve(result);
            }
        );
        upload.end(buffer);
    });
};

const uploadPrescriptionBuffer = (buffer, userId) => {
    return new Promise((resolve, reject) => {
        const folder = `${process.env.CLOUDINARY_FOLDER || 'RxSense'}/prescriptions`;
        const stream = cloudinary.uploader.upload_stream(
            {
                folder,
                public_id: `rx_${userId}_${Date.now()}`,
                resource_type: 'image',
                transformation: [{ quality: 'auto', fetch_format: 'auto' }],
            },
            (err, result) => {
                if (err) return reject(err);
                resolve(result);
            }
        );
        stream.end(buffer);
    });
};

const uploadReportBuffer = (buffer, userId) => {
    return new Promise((resolve, reject) => {
        const folder = `${process.env.CLOUDINARY_FOLDER || 'RxSense'}/reports`;
        const stream = cloudinary.uploader.upload_stream(
            {
                folder,
                public_id:     `rpt_${userId}_${Date.now()}`,
                resource_type: 'image',
                transformation: [{ quality: 'auto', fetch_format: 'auto' }],
            },
            (err, result) => {
                if (err) return reject(err);
                resolve(result);
            }
        );
        stream.end(buffer);
    });
};

module.exports = {
    uploadAvatarBuffer,
    uploadPrescriptionBuffer,
    uploadReportBuffer,
}