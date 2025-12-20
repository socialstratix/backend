import { google } from 'googleapis';
import { Readable } from 'stream';

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
  private initialized: boolean = false;

  constructor() {
    // Lazy initialization - only initialize when actually needed
    // This allows the server to start even if credentials aren't configured yet
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initializeDrive();
    this.initialized = true;
  }

  private initializeDrive(): void {
    try {
      const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

      if (!parentFolderId) {
        throw new Error(
          'GOOGLE_DRIVE_FOLDER_ID is required. ' +
          'Please create a folder in your Google Drive and set GOOGLE_DRIVE_FOLDER_ID to the folder ID. ' +
          'See: https://developers.google.com/drive/api/guides/folder#get_the_id_of_a_folder'
        );
      }

      this.parentFolderId = parentFolderId;

      // Check if using OAuth2 (preferred) or Service Account (legacy)
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

      if (clientId && clientSecret && refreshToken) {
        // Use OAuth2 with refresh token (recommended - files owned by your account)
        console.log('🔐 Using OAuth2 authentication (files will be owned by your Google account)');
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
          throw new Error(
            'Google Drive credentials not configured. ' +
            'Either set OAuth2 credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN) ' +
            'or Service Account credentials (GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL, GOOGLE_DRIVE_PRIVATE_KEY). ' +
            'OAuth2 is recommended as files will be owned by your Google account.'
          );
        }

        console.log('⚠️ Using Service Account (legacy). Consider switching to OAuth2.');
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
      console.error('Failed to initialize Google Drive:', error.message);
      throw error;
    }
  }

  /**
   * Verify that the parent folder is accessible
   */
  private async verifyFolderAccess(): Promise<void> {
    if (!this.parentFolderId) {
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

      console.log(`✅ Verified access to folder: ${folder.data.name} (${this.parentFolderId})`);
    } catch (error: any) {
      if (error.code === 404) {
        throw new Error(
          `Folder ${this.parentFolderId} not found. Please verify the folder ID is correct and that it's shared with the service account (${process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL}).`
        );
      } else if (error.code === 403) {
        throw new Error(
          `Access denied to folder ${this.parentFolderId}. Please ensure the folder is shared with the service account (${process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL}) with Editor permissions.`
        );
      }
      throw error;
    }
  }

  /**
   * Get or create folder by type
   */
  private async getOrCreateFolder(folderType: 'brand' | 'influencer-profile' | 'influencer-cover'): Promise<string> {
    await this.ensureInitialized();
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
      if (error.code === 403 || error.message.includes('storage quota')) {
        throw new Error(
          `Cannot create folder in shared drive. Ensure the folder (${this.parentFolderId}) is shared with Editor permissions. ` +
          `Error: ${error.message}`
        );
      }
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
      if (error.code === 403 || error.message.includes('storage quota')) {
        throw new Error(
          `Cannot create folder in shared drive. Ensure the folder (${this.parentFolderId}) is shared with Editor permissions. ` +
          `Error: ${error.message}`
        );
      }
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
   * Upload file to Google Drive
   */
  async uploadFile(options: UploadFileOptions): Promise<string> {
    await this.ensureInitialized();
    
    try {
      const { buffer, filename, mimetype, folderType } = options;

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

      // Verify the target folder is accessible and in the shared drive
      try {
        const targetFolder = await this.drive.files.get({
          fileId: folderId,
          fields: 'id, name, parents, driveId',
          supportsAllDrives: true,
        });
        
        console.log(`📤 Uploading file: ${filename} to folder: ${targetFolder.data.name} (${folderId})`);
        console.log(`   Folder parents: ${JSON.stringify(targetFolder.data.parents)}`);
        console.log(`   Folder driveId: ${targetFolder.data.driveId || 'none (My Drive)'}`);
        
        // If folder has a driveId, it's in a shared drive - that's good
        // If no driveId, check if it's in our shared folder structure
        if (!targetFolder.data.driveId) {
          // Check if folder is in our shared folder structure
          let currentFolderId = folderId;
          let isInSharedFolder = false;
          let depth = 0;
          
          while (depth < 5 && currentFolderId) {
            try {
              const currentFolder = await this.drive.files.get({
                fileId: currentFolderId,
                fields: 'id, parents',
                supportsAllDrives: true,
              });
              
              if (currentFolder.data.id === this.parentFolderId) {
                isInSharedFolder = true;
                break;
              }
              
              if (currentFolder.data.parents && currentFolder.data.parents.length > 0) {
                currentFolderId = currentFolder.data.parents[0];
              } else {
                break;
              }
              depth++;
            } catch (e) {
              break;
            }
          }
          
          if (!isInSharedFolder) {
            console.error(`❌ Folder ${folderId} is NOT in the shared folder structure!`);
            console.error(`   Expected parent: ${this.parentFolderId}`);
            console.error(`   This folder may have been created in the service account's drive.`);
            console.error(`   Solution: Delete the existing subfolders and let the system recreate them.`);
            throw new Error(
              `Folder ${folderId} is not in the shared folder. ` +
              `Please delete existing subfolders (brands, influencers) from the service account's drive ` +
              `and let the system recreate them in the shared folder.`
            );
          }
        }
      } catch (verifyError: any) {
        if (verifyError.message.includes('not in the shared folder')) {
          throw verifyError;
        }
        console.warn(`⚠️ Could not verify folder location: ${verifyError.message}`);
      }

      console.log(`📤 Starting file upload to folder: ${folderId}`);
      const file = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, webViewLink, webContentLink, thumbnailLink, parents',
        supportsAllDrives: true,
      });
      
      console.log(`✅ File uploaded successfully: ${file.data.id}`);
      console.log(`   File parents: ${JSON.stringify(file.data.parents)}`);

      const fileId = file.data.id!;

      // Make file publicly accessible (anyone with link can view)
      // This is required for images to be visible in the frontend
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

      // Ownership transfer only needed for Service Accounts (OAuth2 files are already owned by user)
      // Check if we're using Service Account by looking for the env var
      if (process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL && !process.env.GOOGLE_REFRESH_TOKEN) {
        // Using Service Account - need to transfer ownership
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
            console.warn(`   Enable domain-wide delegation or manually transfer ownership.`);
          }
        } else {
          // Try to get owner from folder
          try {
            const parentFolder = await this.drive.files.get({
              fileId: this.parentFolderId!,
              fields: 'owners',
              supportsAllDrives: true,
            });

            if (parentFolder.data.owners && parentFolder.data.owners.length > 0) {
              const folderOwnerEmail = parentFolder.data.owners[0].emailAddress;
              console.log(`🔄 Attempting to transfer file ownership to folder owner: ${folderOwnerEmail}`);
              
              try {
                await this.drive.permissions.create({
                  fileId: fileId,
                  requestBody: {
                    role: 'owner',
                    type: 'user',
                    emailAddress: folderOwnerEmail,
                  },
                  supportsAllDrives: true,
                  transferOwnership: true,
                });
                console.log(`✅ File ownership transferred to: ${folderOwnerEmail}`);
              } catch (transferError: any) {
                console.warn(`⚠️ Could not automatically transfer ownership: ${transferError.message}`);
                console.warn(`   Set GOOGLE_DRIVE_FOLDER_OWNER_EMAIL in .env or enable domain-wide delegation.`);
              }
            }
          } catch (ownerError: any) {
            console.warn(`⚠️ Could not get folder owner: ${ownerError.message}`);
          }
        }
      } else {
        // Using OAuth2 - file is already owned by the authenticated user, no transfer needed
        console.log(`✅ File uploaded and owned by your Google account (OAuth2 mode)`);
      }

      // Make file publicly accessible (anyone with link can view)
      // This MUST be done for images to be visible in the frontend
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
        console.log(`✅ File is now publicly accessible (anyone with link can view)`);
      } catch (permissionError: any) {
        console.error(`❌ Failed to set public permissions: ${permissionError.message}`);
        console.error(`   File ID: ${fileId}`);
        console.error(`   The file may not be visible in the frontend.`);
        // Don't throw - file was uploaded successfully, just not publicly accessible
        // User can manually share it if needed
      }

      // Get public URL for the image
      // Use uc?export=view format - this works better in React apps (avoids CORS issues)
      // Format: https://drive.google.com/uc?export=view&id=FILE_ID
      const publicUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
      console.log(`📷 Generated image URL: ${publicUrl}`);
      console.log(`   File ID: ${fileId}`);
      console.log(`   File sharing: Anyone with the link can view`);
      
      return publicUrl;
    } catch (error: any) {
      console.error('Failed to upload file to Google Drive:', error.message);
      
      // Provide helpful error message for storage quota issues
      if (error.message.includes('storage quota') || 
          error.message.includes('Service Accounts do not have storage') ||
          error.code === 403 ||
          (error.response && error.response.status === 403)) {
        
        const serviceAccountEmail = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL || 'your-service-account@project.iam.gserviceaccount.com';
        const folderId = this.parentFolderId || 'NOT_SET';
        
        throw new Error(
          `Service Account storage quota issue. ` +
          `Please verify:\n` +
          `1. GOOGLE_DRIVE_FOLDER_ID is set to: ${folderId}\n` +
          `2. The folder is shared with: ${serviceAccountEmail}\n` +
          `3. The service account has "Editor" permissions (not just Viewer)\n` +
          `4. The folder is in a regular Google Drive account (not the service account's drive)\n` +
          `5. Wait a few minutes after sharing for permissions to propagate`
        );
      }
      
      throw new Error(`File upload failed: ${error.message}`);
    }
  }

  /**
   * Delete file from Google Drive by URL or file ID
   */
  async deleteFile(fileUrlOrId: string): Promise<void> {
    await this.ensureInitialized();
    
    try {
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

      await this.drive.files.delete({
        fileId: fileId,
      });
    } catch (error: any) {
      // If file not found, that's okay (already deleted or doesn't exist)
      if (error.code === 404) {
        console.warn(`File not found for deletion: ${fileUrlOrId}`);
        return;
      }
      console.error('Failed to delete file from Google Drive:', error.message);
      throw new Error(`File deletion failed: ${error.message}`);
    }
  }

  /**
   * Get file public URL from file ID
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

