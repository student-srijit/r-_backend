import User from '../models/User.js';
import { generateToken } from '../utils/jwt.js';
import { validateEmail, validatePassword } from '../utils/validators.js';
import { HTTP_STATUS } from '../utils/constants.js';

export const register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Validate input
    if (!validateEmail(email)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid email format',
      });
    }

    if (!validatePassword(password)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: 'Email already registered',
      });
    }

    // Create new user
    const user = new User({
      email,
      passwordHash: password,
      firstName: firstName || '',
      lastName: lastName || '',
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'User registered successfully',
      data: {
        userId: user._id,
        email: user.email,
        token,
      },
    });
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.email) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: 'Email already registered',
      });
    }
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Find user
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Login successful',
      data: {
        userId: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = (req, res) => {
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Logout successful',
  });
};
