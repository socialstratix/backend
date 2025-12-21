import { google } from 'googleapis';
import { Readable } from 'stream';
import { v2 as cloudinary } from 'cloudinary';

interface UploadFileOptions {
  buffer: Buffer;
  filename: string;
  mimetype: string;
  folderType: 'brand' | 'influencer-profile' | 'influencer-cover';
}

interface FolderMap {
  [key: string]: string;
}

class StorageService {
  private drive: any;
  private folderCache: FolderMap = {};
  private parentFolderId: string | null = null;
  private driveInitialized: boolean = false;
  private cloudinaryInitialized: boolean = false;

  constructor() {
    // Lazy initialization - only initialize when actually needed
    // This allows the server to start even if credentials aren't configured yet
  }

  /**
   * Initialize Cloudinary
   */
  private initializeCloudinary(): void {
    if (this.cloudinaryInitialized) {
      return;
    }

    try {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;

      if (!cloudName || !apiKey || !apiSecret) {
        console.warn('⚠️ Cloudinary credentials not configured. Will use Google Drive fallback only.');
        return;
      }

      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });

      this.cloudinaryInitialized = true;
      console.log('☁️ Cloudinary initialized successfully');
    } catch (error: any) {
      console.warn('⚠️ Failed to initialize Cloudinary:', error.message);
      console.warn('   Will use Google Drive fallback only.');
    }
  }

  /**
   * Initialize Google Drive (for fallback)
   */
  private async ensureDriveInitialized(): Promise<void> {
    if (this.driveInitialized) {
      return;
    }
    this.initializeDrive();
    this.driveInitialized = true;
  }

  private initializeDrive(): void {
    try {
      const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

      if (!parentFolderId) {
        console.warn('⚠️ GOOGLE_DRIVE_FOLDER_ID not set. Google Drive fallback will not be available.');
        return;
      }

      this.parentFolderId = parentFolderId;

      // Check if using OAuth2 (preferred) or Service Account (legacy)
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

      if (clientId && clientSecret && refreshToken) {
        // Use OAuth2 with refresh token (recommended - files owned by your account)
        console.log('🔐 Using OAuth2 authentication for Google Drive fallback');
        const oauth2Client = new google.auth.OAuth2(
          clientId,
          clientSecret
        );

        oauth2Client.setCredentials({
          refresh_token: refreshToken,
        });

        this.drive = google.drive({ version: 'v3', auth: oauth2Client });
      } else {
        // Fallback to Service Account (legacy - requires shared folder)
        const serviceAccountEmail = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL;
        const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        if (!serviceAccountEmail || !privateKey) {
          console.warn('⚠️ Google Drive credentials not configured. Fallback will not be available.');
          return;
        }

        console.log('⚠️ Using Service Account for Google Drive fallback (legacy).');
        console.log('   Service Accounts have no storage quota - files must be in a shared folder.');

        const auth = new google.auth.JWT({
          email: serviceAccountEmail,
          key: privateKey,
          scopes: ['https://www.googleapis.com/auth/drive'],
        });

        this.drive = google.drive({ version: 'v3', auth });
      }
      
      // Verify folder access on initialization
      this.verifyFolderAccess().catch((error) => {
        console.warn('Folder access verification failed:', error.message);
      });
    } catch (error: any) {
      console.warn('Failed to initialize Google Drive:', error.message);
      // Don't throw - Drive is just a fallback
    }
  }

  /**
   * Verify that the parent folder is accessible
   */
  private async verifyFolderAccess(): Promise<void> {
    if (!this.parentFolderId || !this.drive) {
      return;
    }

    try {
      const folder = await this.drive.files.get({
        fileId: this.parentFolderId,
        fields: 'id, name, permissions',
        supportsAllDrives: true,
      });

      if (!folder.data) {
        throw new Error(`Folder ${this.parentFolderId} not found or not accessible`);
      }

      console.log(`✅ Verified access to Google Drive folder: ${folder.data.name} (${this.parentFolderId})`);
    } catch (error: any) {
      if (error.code === 404) {
        console.warn(`Folder ${this.parentFolderId} not found. Please verify the folder ID is correct.`);
      } else if (error.code === 403) {
        console.warn(`Access denied to folder ${this.parentFolderId}. Please ensure proper permissions.`);
      }
      // Don't throw - this is just verification
    }
  }

  /**
   * Get or create folder by type (for Google Drive)
   */
  private async getOrCreateFolder(folderType: 'brand' | 'influencer-profile' | 'influencer-cover'): Promise<string> {
    await this.ensureDriveInitialized();
    if (!this.drive) {
      throw new Error('Google Drive not initialized');
    }

    // Check cache first
    if (this.folderCache[folderType]) {
      return this.folderCache[folderType];
    }

    try {
      const folderPath = this.getFolderPath(folderType);
      const folderName = folderPath.split('/').pop() || folderType;
      const parentFolderName = folderPath.includes('/') ? folderPath.split('/')[0] : null;

      // Start with the shared parent folder
      let parentId = this.parentFolderId!;

      // If we have a nested structure (e.g., influencers/profile), create parent first
      if (parentFolderName && parentFolderName !== folderName) {
        parentId = await this.getOrCreateParentFolder(parentFolderName);
      }

      // Search for existing folder in the shared folder structure
      const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false and '${parentId}' in parents`;

      console.log(`🔍 Searching for folder: ${folderName} in parent: ${parentId}`);

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      let folderId: string;

      if (response.data.files && response.data.files.length > 0) {
        // Folder exists
        folderId = response.data.files[0].id!;
        console.log(`✅ Found existing folder: ${folderName} (${folderId})`);
      } else {
        // Create folder in the shared folder
        console.log(`📁 Creating folder: ${folderName} in parent: ${parentId}`);
        const folderMetadata: any = {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId],
        };

        const folder = await this.drive.files.create({
          requestBody: folderMetadata,
          fields: 'id, name',
          supportsAllDrives: true,
        });

        folderId = folder.data.id!;
        console.log(`✅ Created folder: ${folder.data.name} (${folderId})`);
      }

      // Cache the folder ID
      this.folderCache[folderType] = folderId;
      return folderId;
    } catch (error: any) {
      console.error(`❌ Failed to get or create folder for ${folderType}:`, error.message);
      throw new Error(`Failed to setup folder structure: ${error.message}`);
    }
  }

  /**
   * Get or create parent folder (e.g., 'influencers')
   */
  private async getOrCreateParentFolder(folderName: string): Promise<string> {
    const cacheKey = `parent_${folderName}`;
    if (this.folderCache[cacheKey]) {
      return this.folderCache[cacheKey];
    }

    try {
      // Always use parentFolderId since it's required (Service Accounts need shared folders)
      const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false and '${this.parentFolderId}' in parents`;

      console.log(`🔍 Searching for parent folder: ${folderName} in shared folder: ${this.parentFolderId}`);

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      let folderId: string;

      if (response.data.files && response.data.files.length > 0) {
        folderId = response.data.files[0].id!;
        console.log(`✅ Found existing parent folder: ${folderName} (${folderId})`);
      } else {
        // Always use parentFolderId since it's required
        console.log(`📁 Creating parent folder: ${folderName} in shared folder: ${this.parentFolderId}`);
        const folderMetadata: any = {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [this.parentFolderId],
        };

        const folder = await this.drive.files.create({
          requestBody: folderMetadata,
          fields: 'id, name',
          supportsAllDrives: true,
        });

        folderId = folder.data.id!;
        console.log(`✅ Created parent folder: ${folder.data.name} (${folderId})`);
      }

      this.folderCache[cacheKey] = folderId;
      return folderId;
    } catch (error: any) {
      console.error(`❌ Failed to get or create parent folder ${folderName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get folder path based on type
   */
  private getFolderPath(folderType: 'brand' | 'influencer-profile' | 'influencer-cover'): string {
    const folderMap: { [key: string]: string } = {
      'brand': 'brands',
      'influencer-profile': 'influencers/profile',
      'influencer-cover': 'influencers/cover',
    };
    return folderMap[folderType] || folderType;
  }

  /**
   * Upload file to Cloudinary (primary) with Google Drive fallback
   */
  async uploadFile(options: UploadFileOptions): Promise<string> {
    const { buffer, filename, mimetype, folderType } = options;

    // Try Cloudinary first
    this.initializeCloudinary();
    
    if (this.cloudinaryInitialized) {
      try {
        const folderPath = this.getFolderPath(folderType);
        
        console.log(`☁️ Attempting to upload to Cloudinary: ${filename} in folder: ${folderPath}`);
        
        const result = await new Promise<string>((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: folderPath,
              public_id: filename.replace(/\.[^/.]+$/, ''), // Remove extension for public_id
              resource_type: 'auto',
              overwrite: false,
            },
            (error, result) => {
              if (error) {
                console.error('❌ Cloudinary upload failed:', error.message);
                reject(error);
              } else if (result) {
                console.log(`✅ File uploaded to Cloudinary: ${result.secure_url}`);
                resolve(result.secure_url);
              } else {
                reject(new Error('Cloudinary upload returned no result'));
              }
            }
          );

          // Convert buffer to stream and pipe to Cloudinary
          const bufferStream = Readable.from(buffer);
          bufferStream.on('error', (err) => {
            reject(err);
          });
          bufferStream.pipe(uploadStream);
        });

        return result;
      } catch (cloudinaryError: any) {
        console.error('❌ Cloudinary upload failed:', cloudinaryError.message);
        console.log('🔄 Falling back to Google Drive...');
        // Continue to fallback
      }
    }

    // Fallback to Google Drive
    try {
      await this.ensureDriveInitialized();
      
      if (!this.drive) {
        throw new Error('Neither Cloudinary nor Google Drive is available');
      }

      console.log(`📤 Uploading to Google Drive (fallback): ${filename}`);

      // Verify parent folder access first
      if (this.parentFolderId) {
        try {
          await this.verifyFolderAccess();
        } catch (verifyError: any) {
          throw new Error(`Cannot access shared folder: ${verifyError.message}`);
        }
      }

      // Get or create the appropriate folder
      const folderId = await this.getOrCreateFolder(folderType);

      // Convert buffer to stream
      const stream = Readable.from(buffer);

      // Upload file
      const fileMetadata = {
        name: filename,
        parents: [folderId],
      };

      const media = {
        mimeType: mimetype,
        body: stream,
      };

      console.log(`📤 Starting file upload to folder: ${folderId}`);
      const file = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, webViewLink, webContentLink, thumbnailLink, parents',
        supportsAllDrives: true,
      });
      
      console.log(`✅ File uploaded successfully to Google Drive: ${file.data.id}`);

      const fileId = file.data.id!;

      // Make file publicly accessible (anyone with link can view)
      console.log(`🔓 Making file publicly accessible: ${fileId}`);
      try {
        await this.drive.permissions.create({
          fileId: fileId,
          requestBody: {
            role: 'reader',
            type: 'anyone',
          },
          supportsAllDrives: true,
        });
        console.log(`✅ File is now publicly accessible`);
      } catch (permissionError: any) {
        console.warn(`⚠️ Could not set public permissions: ${permissionError.message}`);
        console.warn(`   File may not be visible in frontend. You may need to manually share it.`);
      }

      // Ownership transfer only needed for Service Accounts
      if (process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL && !process.env.GOOGLE_REFRESH_TOKEN) {
        const ownerEmail = process.env.GOOGLE_DRIVE_FOLDER_OWNER_EMAIL;
        
        if (ownerEmail) {
          console.log(`🔄 Transferring file ownership to: ${ownerEmail} (Service Account mode)`);
          try {
            await this.drive.permissions.create({
              fileId: fileId,
              requestBody: {
                role: 'owner',
                type: 'user',
                emailAddress: ownerEmail,
              },
              supportsAllDrives: true,
              transferOwnership: true,
            });
            console.log(`✅ File ownership transferred to: ${ownerEmail}`);
          } catch (transferError: any) {
            console.warn(`⚠️ Could not transfer ownership: ${transferError.message}`);
          }
        }
      }

      // Get public URL for the image
      const publicUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
      console.log(`📷 Generated image URL: ${publicUrl}`);
      
      return publicUrl;
    } catch (driveError: any) {
      console.error('❌ Google Drive fallback also failed:', driveError.message);
      throw new Error(`File upload failed on both Cloudinary and Google Drive: ${driveError.message}`);
    }
  }

  /**
   * Check if URL is from Cloudinary
   */
  private isCloudinaryUrl(url: string): boolean {
    return url.includes('cloudinary.com') || url.includes('res.cloudinary.com');
  }

  /**
   * Check if URL is from Google Drive
   */
  private isDriveUrl(url: string): boolean {
    return url.includes('drive.google.com');
  }

  /**
   * Extract public ID from Cloudinary URL
   */
  private extractCloudinaryPublicId(url: string): string | null {
    // Cloudinary URLs format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/{version}/{folder}/{public_id}.{format}
    // Or: https://res.cloudinary.com/{cloud_name}/image/upload/{folder}/{public_id}.{format}
    // Match everything after /upload/ (optionally with version) until the file extension
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)\.(jpg|jpeg|png|gif|webp|pdf|mp4|mov|avi|mp3|wav)(?:\?|$)/i);
    if (match && match[1]) {
      // Return the full public_id including folder path
      return match[1];
    }
    return null;
  }

  /**
   * Delete file from Cloudinary or Google Drive based on URL
   */
  async deleteFile(fileUrlOrId: string): Promise<void> {
    // Try Cloudinary first if it's a Cloudinary URL
    if (this.isCloudinaryUrl(fileUrlOrId)) {
      try {
        this.initializeCloudinary();
        
        if (this.cloudinaryInitialized) {
          const publicId = this.extractCloudinaryPublicId(fileUrlOrId);
          
          if (publicId) {
            console.log(`🗑️ Deleting from Cloudinary: ${publicId}`);
            const result = await cloudinary.uploader.destroy(publicId, {
              resource_type: 'auto',
            });
            
            if (result.result === 'ok') {
              console.log(`✅ File deleted from Cloudinary: ${publicId}`);
              return;
            } else {
              console.warn(`⚠️ Cloudinary deletion returned: ${result.result}`);
            }
          } else {
            console.warn(`⚠️ Could not extract public_id from Cloudinary URL: ${fileUrlOrId}`);
          }
        }
      } catch (cloudinaryError: any) {
        console.warn(`⚠️ Failed to delete from Cloudinary: ${cloudinaryError.message}`);
        // Continue to try Drive as fallback
      }
    }

    // Try Google Drive if it's a Drive URL or if Cloudinary failed
    if (this.isDriveUrl(fileUrlOrId)) {
      try {
        await this.ensureDriveInitialized();
        
        if (!this.drive) {
          console.warn('⚠️ Google Drive not initialized, cannot delete file');
          return;
        }

        // Extract file ID from URL if it's a URL
        let fileId = fileUrlOrId;
        
        // Check if it's a Google Drive URL
        const urlMatch = fileUrlOrId.match(/[?&]id=([^&]+)/);
        if (urlMatch) {
          fileId = urlMatch[1];
        } else if (fileUrlOrId.includes('drive.google.com')) {
          // Try to extract from other URL formats
          const idMatch = fileUrlOrId.match(/\/d\/([^\/]+)/);
          if (idMatch) {
            fileId = idMatch[1];
          }
        }

        console.log(`🗑️ Deleting from Google Drive: ${fileId}`);
        await this.drive.files.delete({
          fileId: fileId,
        });
        console.log(`✅ File deleted from Google Drive: ${fileId}`);
        return;
      } catch (error: any) {
        // If file not found, that's okay (already deleted or doesn't exist)
        if (error.code === 404) {
          console.warn(`File not found for deletion: ${fileUrlOrId}`);
          return;
        }
        console.warn(`⚠️ Failed to delete from Google Drive: ${error.message}`);
        // Don't throw - best effort cleanup
      }
    }

    // If we get here, we couldn't determine the service or deletion failed
    // Log a warning but don't throw (best effort cleanup)
    console.warn(`⚠️ Could not delete file: ${fileUrlOrId} (unknown service or deletion failed)`);
  }

  /**
   * Get file public URL from file ID (for Google Drive compatibility)
   */
  getPublicUrl(fileId: string): string {
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }

  /**
   * Clear folder cache (useful if folders need to be recreated)
   */
  clearCache(): void {
    this.folderCache = {};
    console.log('🗑️ Folder cache cleared');
  }
}

// Export singleton instance
export const storageService = new StorageService();
export default storageService;
