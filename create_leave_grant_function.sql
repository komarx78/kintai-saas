-- ==========================================
-- 有給休暇自動付与・時効消滅ロジック PostgreSQL関数
-- ==========================================

CREATE OR REPLACE FUNCTION process_annual_paid_leave_grants()
RETURNS void AS $$
DECLARE
  emp RECORD;
  grant_days NUMERIC(5,2);
  months_worked INT;
  is_grant_day BOOLEAN;
  actual_days_worked INT;
  annual_days INT;
BEGIN
  -- 1. 入社日が設定されている全従業員をループ
  FOR emp IN SELECT * FROM users WHERE join_date IS NOT NULL LOOP
    is_grant_day := FALSE;
    grant_days := 0;
    
    -- 2. 該当日判定（入社から6ヶ月後、またはそれ以降1年ごと）
    IF current_date = (emp.join_date + INTERVAL '6 months')::DATE THEN
      months_worked := 6;
      is_grant_day := TRUE;
    ELSIF current_date > (emp.join_date + INTERVAL '6 months')::DATE THEN
      -- 半年後からの経過年数がちょうど整数になる日付かどうかを判定
      IF current_date = (emp.join_date + INTERVAL '6 months' + ((extract(year from age(current_date, emp.join_date + INTERVAL '6 months')))::INT || ' years')::INTERVAL)::DATE THEN
        months_worked := 6 + (extract(year from age(current_date, emp.join_date + INTERVAL '6 months')))::INT * 12;
        is_grant_day := TRUE;
      END IF;
    END IF;

    -- 3. 付与の実行
    IF is_grant_day THEN
      
      IF emp.employment_type = 'full-time' THEN
        -- 正社員の法定付与日数
        CASE
          WHEN months_worked = 6 THEN grant_days := 10;
          WHEN months_worked = 18 THEN grant_days := 11;
          WHEN months_worked = 30 THEN grant_days := 12;
          WHEN months_worked = 42 THEN grant_days := 14;
          WHEN months_worked = 54 THEN grant_days := 16;
          WHEN months_worked = 66 THEN grant_days := 18;
          ELSE grant_days := 20; -- 6.5年以上は20日で頭打ち
        END CASE;
        
      ELSE
        -- パートタイマーの比例付与（実労働実績ベース）
        -- 過去の実労働日数をカウント
        IF months_worked = 6 THEN
          -- 初回（6ヶ月）の場合は過去6ヶ月を集計
          SELECT COUNT(*) INTO actual_days_worked
          FROM attendance_records
          WHERE user_id = emp.id 
            AND check_in_time IS NOT NULL
            AND date >= emp.join_date 
            AND date < current_date;
            
          annual_days := actual_days_worked * 2; -- 年間換算
        ELSE
          -- 2回目以降は過去1年（365日）を集計
          SELECT COUNT(*) INTO actual_days_worked
          FROM attendance_records
          WHERE user_id = emp.id 
            AND check_in_time IS NOT NULL
            AND date >= (current_date - INTERVAL '1 year') 
            AND date < current_date;
            
          annual_days := actual_days_worked;
        END IF;

        -- 比例付与日数テーブルに基づく計算
        IF annual_days >= 217 THEN
           CASE months_worked WHEN 6 THEN grant_days := 10; WHEN 18 THEN grant_days := 11; WHEN 30 THEN grant_days := 12; WHEN 42 THEN grant_days := 14; WHEN 54 THEN grant_days := 16; WHEN 66 THEN grant_days := 18; ELSE grant_days := 20; END CASE;
        ELSIF annual_days >= 169 THEN
           CASE months_worked WHEN 6 THEN grant_days := 7; WHEN 18 THEN grant_days := 8; WHEN 30 THEN grant_days := 9; WHEN 42 THEN grant_days := 10; WHEN 54 THEN grant_days := 12; WHEN 66 THEN grant_days := 13; ELSE grant_days := 15; END CASE;
        ELSIF annual_days >= 121 THEN
           CASE months_worked WHEN 6 THEN grant_days := 5; WHEN 18 THEN grant_days := 6; WHEN 30 THEN grant_days := 6; WHEN 42 THEN grant_days := 8; WHEN 54 THEN grant_days := 9; WHEN 66 THEN grant_days := 10; ELSE grant_days := 11; END CASE;
        ELSIF annual_days >= 73 THEN
           CASE months_worked WHEN 6 THEN grant_days := 3; WHEN 18 THEN grant_days := 4; WHEN 30 THEN grant_days := 4; WHEN 42 THEN grant_days := 5; WHEN 54 THEN grant_days := 6; WHEN 66 THEN grant_days := 6; ELSE grant_days := 7; END CASE;
        ELSIF annual_days >= 48 THEN
           CASE months_worked WHEN 6 THEN grant_days := 1; WHEN 18 THEN grant_days := 2; WHEN 30 THEN grant_days := 2; WHEN 42 THEN grant_days := 2; WHEN 54 THEN grant_days := 3; WHEN 66 THEN grant_days := 3; ELSE grant_days := 3; END CASE;
        ELSE
           grant_days := 0; -- 労働日数が少なすぎる場合は付与なし
        END IF;
      END IF;

      -- 4. DB更新処理
      IF grant_days > 0 THEN
        -- 残数ロジックの更新
        -- 古い carryover は時効消滅し、昨年の balance が新しい carryover になる
        UPDATE users 
        SET 
          paid_leave_carryover = paid_leave_balance,
          paid_leave_balance = grant_days
        WHERE id = emp.id;

        -- 付与履歴に保存 (有効期限は2年後)
        INSERT INTO paid_leave_grants (tenant_id, user_id, grant_date, granted_days, expiration_date, note)
        VALUES (
          emp.tenant_id, 
          emp.id, 
          current_date, 
          grant_days, 
          current_date + INTERVAL '2 years', 
          '法定付与（勤続 ' || (months_worked/12.0) || ' 年）'
        );
      END IF;

    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 毎晩0時（日本時間の0時＝UTCの15時）に実行するための pg_cron 登録例
-- ※拡張機能が有効な場合のみ実行可能
-- SELECT cron.schedule('grant_paid_leaves', '0 15 * * *', 'SELECT process_annual_paid_leave_grants();');
