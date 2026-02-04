import * as vscode from 'vscode';
import type { PasswordAndHint } from '../types';

/**
 * Extended InputBoxOptions with validation support
 */
interface InputBoxOptionsWithValidation extends vscode.InputBoxOptions {
  validate?: (value: string) => string | null | undefined;
}

/**
 * Result from password prompt
 */
export interface PasswordPromptResult {
  confirmed: boolean;
  password: string;
  hint: string;
}

/**
 * Multi-step input for password collection
 */
class MultiStepInput {
  static async run<T>(start: (input: MultiStepInput) => Thenable<T>) {
    const input = new MultiStepInput();
    return await start(input);
  }

  async showInputBox(options: InputBoxOptionsWithValidation & { title?: string }): Promise<string> {
    const validate = options.validate;
    delete (options as any).validate;

    while (true) {
      const result = await vscode.window.showInputBox({
        ...options,
        ignoreFocusOut: true
      });

      if (result === undefined) {
        return '';
      }

      if (validate) {
        const error = validate(result);
        if (error) {
          vscode.window.showErrorMessage(error);
          continue;
        }
      }

      return result;
    }
  }
}

/**
 * Password Prompt Dialog
 * Collects password, confirmation, and optional hint
 */
export class PasswordPrompt {
  /**
   * Show password prompt for encryption
   */
  static async showForEncryption(options: {
    confirmPassword?: boolean;
    defaultPassword?: string;
    defaultHint?: string;
  }): Promise<PasswordPromptResult> {
    const result: PasswordPromptResult = {
      confirmed: false,
      password: options.defaultPassword ?? '',
      hint: options.defaultHint ?? ''
    };

    const confirmPassword = options.confirmPassword ?? true;

    await MultiStepInput.run(async (input) => {
      // Step 1: Enter password
      result.password = await input.showInputBox({
        title: confirmPassword ? 'Enter Password (1/2)' : 'Enter Password',
        password: true,
        prompt: 'Enter a password to encrypt',
        value: result.password,
        validate: (value: string) => {
          if (!value || value.length < 1) {
            return 'Password cannot be empty';
          }
          return null;
        }
      });

      if (!result.password) {
        return;
      }

      // Step 2: Confirm password (if required)
      if (confirmPassword) {
        const confirmed = await input.showInputBox({
          title: 'Confirm Password (2/2)',
          password: true,
          prompt: 'Confirm your password',
          validate: (value: string) => {
            if (value !== result.password) {
              return 'Passwords do not match';
            }
            return null;
          }
        });

        if (!confirmed) {
          result.password = '';
          return;
        }
      }

      // Step 3: Optional hint
      result.hint = await input.showInputBox({
        title: 'Password Hint (Optional)',
        prompt: 'Enter a hint to help you remember the password',
        value: result.hint
      });

      result.confirmed = true;
    });

    return result;
  }

  /**
   * Show password prompt for decryption
   */
  static async showForDecryption(options: {
    hint?: string;
    defaultPassword?: string;
  }): Promise<PasswordAndHint | null> {
    const hint = options.hint ?? '';
    const defaultPassword = options.defaultPassword ?? '';

    const prompt = hint
      ? `Enter password to decrypt (Hint: ${hint})`
      : 'Enter password to decrypt';

    while (true) {
      const password = await vscode.window.showInputBox({
        title: 'Decrypt',
        password: true,
        prompt,
        value: defaultPassword,
        ignoreFocusOut: true
      });

      if (!password) {
        return null;
      }

      if (password && password.length >= 1) {
        return { password, hint };
      }

      vscode.window.showErrorMessage('Password cannot be empty');
    }
  }

  /**
   * Show change password dialog
   */
  static async showForChangePassword(options: {
    currentHint?: string;
  }): Promise<{ current: PasswordAndHint; new: PasswordAndHint } | null> {
    const result = {
      current: { password: '', hint: options.currentHint ?? '' } as PasswordAndHint,
      new: { password: '', hint: '' } as PasswordAndHint
    };

    await MultiStepInput.run(async (input) => {
      // Step 1: Enter current password
      result.current.password = await input.showInputBox({
        title: 'Change Password - Enter Current Password (1/4)',
        password: true,
        prompt: result.current.hint
          ? `Enter your current password (Hint: ${result.current.hint})`
          : 'Enter your current password',
        validate: (value: string) => {
          if (!value || value.length < 1) {
            return 'Password cannot be empty';
          }
          return null;
        }
      });

      if (!result.current.password) {
        return;
      }

      // Step 2: Enter new password
      result.new.password = await input.showInputBox({
        title: 'Change Password - Enter New Password (2/4)',
        password: true,
        prompt: 'Enter a new password',
        validate: (value: string) => {
          if (!value || value.length < 1) {
            return 'Password cannot be empty';
          }
          if (value === result.current.password) {
            return 'New password must be different from current password';
          }
          return null;
        }
      });

      if (!result.new.password) {
        return;
      }

      // Step 3: Confirm new password
      const confirmed = await input.showInputBox({
        title: 'Change Password - Confirm New Password (3/4)',
        password: true,
        prompt: 'Confirm your new password',
        validate: (value: string) => {
          if (value !== result.new.password) {
            return 'Passwords do not match';
          }
          return null;
        }
      });

      if (!confirmed) {
        result.new.password = '';
        return;
      }

      // Step 4: Optional hint
      result.new.hint = await input.showInputBox({
        title: 'Change Password - New Hint (Optional) (4/4)',
        prompt: 'Enter a hint for your new password'
      });
    });

    if (!result.current.password || !result.new.password) {
      return null;
    }

    return result;
  }
}
