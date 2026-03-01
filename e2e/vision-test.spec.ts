import { test, expect } from '@playwright/test';

test.describe('Landolt Vision Test E2E - Mocked Camera & AI', () => {

    test.beforeEach(async ({ page }) => {
        // Intercept the gesture.ts module from Vite and mock its exports so we don't load MediaPipe
        await page.route('**/src/lib/gesture.ts**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/javascript',
                body: `
          export const initGestureRecognizer = async () => { console.log("Mocked initGestureRecognizer"); return {}; };
          export const detectGesture = () => {
            const gesture = window.__MOCK_GESTURE || 'none';
            return { gesture, score: 0.99, landmarks: [] };
          };
        `
            });
        });
    });

    test('Complete full flow: Calibration -> Setup -> Test -> Result', async ({ page }) => {
        // 1. Calibration Screen
        await page.goto('/');
        await expect(page.locator('h1')).toContainText(/ディスプレイのキャリブレーション|Display Calibration/);
        await page.click('button.btn-primary');

        // 2. Setup Screen
        await expect(page.locator('h1')).toContainText(/検査のセットアップ|Test Configuration/);
        await page.click('button.btn-primary');

        // 3. Test Screen
        await expect(page.locator('.test-view')).toBeVisible();
        await expect(page.locator('.loading-overlay')).not.toBeVisible({ timeout: 5000 });

        // Simulate failing the test by clicking the "Unknown (?)" button repeatedly 
        // until we reach the result screen.
        for (let i = 0; i < 20; i++) {
            if (await page.locator('.result-view').isVisible()) break;
            
            await page.click('button.unknown');
            await page.waitForTimeout(650); // Wait for transition/feedback
        }

        // 4. Result Screen
        await expect(page.locator('.result-view')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('h1')).toContainText(/検査終了|Test Complete/);
        await expect(page.locator('.score')).toBeVisible();

        // 5. Test Restart
        await page.click('button.btn-primary'); // "Test Again"
        await expect(page.locator('.test-view')).toBeVisible();
    });

    test('Settings persistence and auto-skip flow', async ({ page }) => {
        await page.goto('/');
        
        // Adjust PPI slider to 200
        await page.fill('input[type="range"]', '200');
        await page.click('button.btn-primary'); 

        // Setup Screen: Change distance to 2.0m using the '+' button
        await expect(page.locator('h1')).toContainText(/検査のセットアップ|Test Configuration/);
        await page.click('button:has-text("+")');
        await page.click('button:has-text("+")');
        await page.click('button.btn-primary'); 

        // Verify localStorage persistence
        const storage = await page.evaluate(() => {
            const state = JSON.parse(localStorage.getItem('vision_app_state') || '{}');
            return {
                ppi: state.ppi,
                dist: state.distanceM
            };
        });
        expect(storage.ppi).toBe(200);
        expect(storage.dist).toBe(2);

        // Reload page and verify auto-skip to Test screen due to existing settings
        await page.reload();
        await expect(page.locator('.test-view')).toBeVisible();
    });

    test('Language switching works', async ({ page }) => {
        await page.goto('/');
        
        const langSelect = page.locator('select').first();
        await expect(langSelect).toBeVisible();

        // Switch to English
        await langSelect.selectOption('en');
        await expect(page.locator('h1')).toContainText('Display Calibration');
        
        // Switch back to Japanese
        await langSelect.selectOption('ja');
        await expect(page.locator('h1')).toContainText('ディスプレイのキャリブレーション');
    });
});
