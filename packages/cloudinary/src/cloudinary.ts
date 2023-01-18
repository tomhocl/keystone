import fs from 'fs';
import https from 'https';
import crypto from 'crypto';
import { stringify } from 'querystring';
import cloudinary from 'cloudinary';

export type File = { id: string; filename: string; _meta: cloudinary.UploadApiResponse };

export type CloudinaryImageFormat = {
  prettyName?: string | null;
  width?: string | null;
  height?: string | null;
  crop?: string | null;
  aspect_ratio?: string | null;
  gravity?: string | null;
  zoom?: string | null;
  x?: string | null;
  y?: string | null;
  format?: string | null;
  fetch_format?: string | null;
  quality?: string | null;
  radius?: string | null;
  angle?: string | null;
  effect?: string | null;
  opacity?: string | null;
  border?: string | null;
  background?: string | null;
  overlay?: string | null;
  underlay?: string | null;
  default_image?: string | null;
  delay?: string | null;
  color?: string | null;
  color_space?: string | null;
  dpr?: string | null;
  page?: string | null;
  density?: string | null;
  flags?: string | null;
  transformation?: string | null;
};

function encodeFilePart(boundary, type, name, filename) {
  return [
    `--${boundary}`,
    `Content-Disposition: form-data; name="${name}"; filename="${filename}"`,
    `Content-Type: ${type}`,
    '',
    '',
  ].join('\r\n');
}

function random_public_id() {
  return crypto
    .randomBytes(12)
    .toString('base64')
    .replace(/[^a-z0-9]/g, '');
}

export class CloudinaryAdapter {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder?: string;
  constructor({
    cloudName,
    apiKey,
    apiSecret,
    folder,
  }: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
    folder?: string;
  }) {
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('CloudinaryAdapter requires cloudName, apiKey, and apiSecret');
    }
    this.cloudName = cloudName;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.folder = folder || undefined;
  }

  /**
   * Params: { stream, filename, id }
   */
  async save({ stream, filename, id }: { stream: fs.ReadStream; filename: string; id: string }) {
    // Push to cloudinary
    try {
      // pipe the stream to cloudinary using https
      // https://cloudinary.com/documentation/upload_images#uploading_with_a_direct_call_to_the_rest_api
      const boundary = random_public_id();

      const file_header = Buffer.from(
        encodeFilePart(boundary, 'application/octet-stream', 'file', filename),
        'binary'
      );
      const result = await new Promise<cloudinary.UploadApiResponse>((resolve, reject) => {
        const options = {
          public_id: id,
          folder: this.folder,
          api_key: this.apiKey,
          timestamp: Math.floor(new Date().getTime() / 1000),
          cloud_name: this.cloudName,
          //api_secret: this.apiSecret,
          secure: true,
          stream: true,
          //file: `${this.folder}/${filename}`,
        };

        const signature = cloudinary.v2.utils.api_sign_request(
          { folder: options.folder, timestamp: options.timestamp, public_id: options.public_id },
          this.apiSecret
        );

        const queryString = stringify({ ...options, signature });

        const url = `${cloudinary.v2.utils.api_url('upload', options)}?${queryString}`;
        console.log('url', url);

        const cloudinaryStream = https.request(
          url,
          {
            method: 'POST',
            headers: {
              'Content-Type': `multipart/form-data; boundary=${boundary}`,
            },
          },
          res => {
            let buffers: Buffer[] = [];
            res.on('data', chunk => {
              console.log('Cloudinary upload chunk');
              buffers.push(chunk);
            });
            res.on('error', error => {
              console.log('Cloudinary upload error', error);
              reject(error);
            });
            res.on('end', () => {
              console.log('Cloudinary upload complete');
              const data = JSON.parse(Buffer.concat(buffers).toString());
              console.log('data', data);

              resolve(data);
            });
          }
        );
        cloudinaryStream.on('error', error => {
          reject(error);
        });
        cloudinaryStream.write(file_header);
        stream.pipe(cloudinaryStream);
      });

      //const result: cloudinary.UploadApiResponse = await new Promise(resolve => {
      //  const options = {
      //    public_id: id,
      //    folder: this.folder,
      //    api_key: this.apiKey,
      //    api_secret: this.apiSecret,
      //    cloud_name: this.cloudName,
      //  };
      //  const cloudinaryStream = cloudinary.v2.uploader
      //    .upload_stream(options, (error, result) => {
      //      if (error || !result) {
      //        console.log('Cloudinary upload error', error);
      //        throw new GraphQLError('Cloudinary upload error', error);
      //      } else {
      //        resolve(result);
      //      }
      //    })
      //    .on('close', () => {
      //      console.log('Cloudinary upload complete');
      //    });
      //  stream.pipe(cloudinaryStream).on('close', () => {
      //    console.log('Stream closed');
      //  });
      //});

      return {
        // Return the relevant data for the File api
        id,
        filename,
        _meta: result,
      };
    } catch (error) {
      console.log('Cloudinary upload error', error);
      throw new Error('Cloudinary upload error');
    }
  }

  /**
   * Deletes the given file from cloudinary
   * @param file File field data
   * @param options Delete options passed to cloudinary.
   *                For available options refer to the [Cloudinary destroy API](https://cloudinary.com/documentation/image_upload_api_reference#destroy_method).
   */
  delete(file?: File, options = {}) {
    const destroyOptions = {
      // Auth
      api_key: this.apiKey,
      api_secret: this.apiSecret,
      cloud_name: this.cloudName,
      ...options,
    };

    return new Promise((resolve, reject) => {
      if (file) {
        // @ts-ignore
        cloudinary.v2.uploader.destroy(file._meta.public_id, destroyOptions, (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        });
      } else {
        reject(new Error("Missing required argument 'file'."));
      }
    });
  }

  publicUrl(file?: File) {
    return file?._meta?.secure_url || null;
  }

  publicUrlTransformed(file: File, options: CloudinaryImageFormat = {}) {
    if (!file._meta) {
      return null;
    }

    const { prettyName, ...transformation } = options;
    // No formatting options provided, return the publicUrl field
    if (!Object.keys(transformation).length) {
      return this.publicUrl(file);
    }
    const { public_id, format } = file._meta;

    // Docs: https://github.com/cloudinary/cloudinary_npm/blob/439586eac73cee7f2803cf19f885e98f237183b3/src/utils.coffee#L472 (LOL)
    // @ts-ignore
    return cloudinary.url(public_id, {
      type: 'upload',
      format,
      secure: true,
      url_suffix: prettyName,
      transformation,
      cloud_name: this.cloudName,
    });
  }
}
