import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Brand } from '../models/Brand';
import { Influencer } from '../models/Influencer';
import { IUser, UserType, UserPlainObject } from '../types';

export interface SignupData {
  email: string;
  password: string;
  name: string;
  userType: UserType;
  avatar?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export class AuthService {
  /**
   * Sign up a new user
   */
  static async signupUser(data: SignupData): Promise<UserPlainObject> {
    // Check if user already exists
    const existingUser = await User.findOne({ email: data.email.toLowerCase() });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(data.password, saltRounds);

    // Create user
    const user = new User({
      email: data.email.toLowerCase(),
      password: hashedPassword,
      name: data.name,
      userType: data.userType,
      avatar: data.avatar,
      isEmailVerified: false,
    });

    await user.save();

    // Remove password from returned user object
    const userObject = user.toObject();
    delete (userObject as { password?: string }).password;

    return userObject as unknown as UserPlainObject;
  }

  /**
   * Login user and validate credentials
   */
  static async loginUser(data: LoginData): Promise<UserPlainObject> {
    // Find user by email
    const user = await User.findOne({ email: data.email.toLowerCase() }).select('+password');
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Remove password from returned user object
    const userObject = user.toObject();
    delete (userObject as { password?: string }).password;

    return userObject as unknown as UserPlainObject;
  }

  /**
   * Get user by ID with populated profile
   */
  static async getUserById(userId: string): Promise<UserPlainObject | null> {
    const user = await User.findById(userId);
    if (!user) {
      return null;
    }

    // Get profile based on user type
    let profile = null;
    if (user.userType === 'brand') {
      profile = await Brand.findOne({ userId: user._id });
    } else if (user.userType === 'influencer') {
      profile = await Influencer.findOne({ userId: user._id });
    }

    const userObject = user.toObject();
    // Remove password if present
    delete (userObject as { password?: string }).password;
    // Return user object without profile (IUser doesn't include profile)
    // Profile should be accessed separately if needed
    return userObject as unknown as UserPlainObject;
  }

  /**
   * Validate user credentials
   */
  static async validateUserCredentials(email: string, password: string): Promise<boolean> {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return false;
    }

    return await bcrypt.compare(password, user.password);
  }
}

